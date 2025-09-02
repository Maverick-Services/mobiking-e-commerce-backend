import axios from "axios";
import { Order } from "../models/order.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Product } from "../models/product.model.js";

// This function should be used right after order creation in Shiprocket
// controllers/assignBestCourier.js
const assignBestCourier = async (req, res, next) => {
    try {
        const { shipmentId, shiprocketOrderId } = req.order;
        const courierId = req?.body?.courierId;
        const token = req.shiprocketToken;

        if (!shipmentId)
            return res.status(400).json({
                success: false,
                message: "Shipment ID missing"
            });

        if (!courierId)
            return res.status(400).json({
                success: false,
                message: "Courier ID missing"
            });

        // Skip if already assigned
        const freshOrder = await Order.findById(req?.order?._id);
        if (freshOrder?.awbCode) return next();

        const { data } = await axios.post(
            "https://apiv2.shiprocket.in/v1/external/courier/assign/awb",
            { shipment_id: shipmentId, courier_id: courierId },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log("Courier Assign data: ", data);
        let awbCode = null;
        let courierName = null;

        if (data?.awb_assign_status === 1 && data?.response?.data?.awb_code) {
            awbCode = data?.response?.data?.awb_code;
            courierName = data?.response?.data?.courier_name;
        } else if (data?.response?.awb_code) {
            awbCode = data.response.awb_code;
            courierName = data.response.courier_name;
        }

        if (!awbCode) {
            return res.status(502).json({
                success: false,
                message: "Courier assignment failed",
                data,
            });
        }

        // Update DB after courier assigned
        await Order.findByIdAndUpdate(
            req.order._id,
            {
                // ...pickupInfo,
                awbCode,
                courierName,
                courierAssignedAt: new Date(),
                // status: 'Accepted',
                // status: 'Shipped',
                shippingStatus: "Courier Assigned",
            },
            { new: true }
        );

        console.log("Shiprocket order Id: ", shiprocketOrderId);
        // Call Shiprocket API to get full order details to check if pickup is auto scheduled
        const response = await axios.get(
            `https://apiv2.shiprocket.in/v1/external/orders/show/${shiprocketOrderId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const shipData = response?.data?.data;
        console.log("Pickup Auto Schedule check data: ", shipData);

        //if pickupup auto scheduled then update details in db
        let pickupInfo = null;
        if (shipData?.status === "PICKUP SCHEDULED") {
            pickupInfo = {
                pickupScheduled: true,
                pickupDate: shipData?.shipments?.pickup_scheduled_date || shipData.pickup_date,
                shippingStatus: "Pickup Scheduled",
                expectedDeliveryDate: shipData?.shipments?.etd || null,
            }
        }

        // Update DB
        await Order.findByIdAndUpdate(
            req.order._id,
            {
                ...pickupInfo,
                // awbCode,
                // courierName,
                // courierAssignedAt: new Date(),
                // status: 'Accepted',
                status: 'Shipped',
                shippingStatus: pickupInfo ? pickupInfo?.shippingStatus : "Courier Assigned",
            },
            { new: true }
        );

        next();
    } catch (e) {
        console.error("assignBestCourier error:", e?.response?.data || e);
        return res.status(500).json({
            success: false,
            message: "Internal server error during courier assignment",
            data: e?.response?.data || e?.message,
        });
    }
};

// controllers/schedulePickup.js
const schedulePickup = async (req, res, next) => {
    try {
        const shipmentId = req?.order?.shipmentId || req?.body?.shipmentId;
        const orderId = req?.order?._id || req?.body?.orderId;
        const token = req.shiprocketToken;

        if (!orderId)
            return res.status(400).json({
                success: false,
                message: "Order ID missing"
            });

        if (!shipmentId)
            return res.status(400).json({
                success: false,
                message: "Shipment ID missing"
            });

        const freshOrder = await Order.findById(orderId);
        if (freshOrder.pickupScheduled) {
            res.status(200).json({
                success: true,
                message: "Pickup already scheduled",
                pickupDate: freshOrder.pickupDate,
            });
            next();
        }

        const { data } = await axios.post(
            "https://apiv2.shiprocket.in/v1/external/courier/generate/pickup",
            { shipment_id: [shipmentId] },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const pickupTokenNumber = data?.response?.pickup_token_number;
        const pickupDate = data?.response?.pickup_scheduled_date;
        const pickupSlot = data?.response?.pickup_token_data?.slot; // Optional slot info

        if (!pickupDate) {
            return res.status(502).json({
                success: false,
                message: "Pickup scheduling failed",
                data,
            });
        }

        // console.log("Fresh Order", freshOrder);
        const trackData = await axios.get(
            `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${freshOrder?.awbCode}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                }
            }
        );

        // console.log("Track Data: ", trackData);

        // Update order
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                pickupScheduled: true,
                pickupTokenNumber,
                pickupDate,
                pickupSlot: pickupSlot || null,
                // status: 'Accepted',
                shippingStatus: "Pickup Scheduled",
                expectedDeliveryDate: trackData?.data?.tracking_data?.etd || null,
                status: "Shipped",
            },
            { new: true }
        ).populate({
            path: 'userId',
            select: "-password -refreshToken"
        })
            .populate({
                path: "items.productId",
                model: "Product",
                populate: {
                    path: "category",  // This is the key part
                    model: "SubCategory"
                }
            })
            .populate('addressId')
            .exec();

        res.status(200).json({
            success: true,
            message: "Pickup scheduled successfully",
            data: data,
            pickupDate,
            pickupSlot: pickupSlot || null,
        });
        req.order = updatedOrder;
        next();

    } catch (e) {
        console.error("schedulePickup error:", e?.response?.data || e);
        return res.status(500).json({
            success: false,
            message: "Internal server error during pickup scheduling",
            details: e?.response?.data || e?.message,
        });
    }
};

// Helper to call Label+Manifest without response context
const generateLabelAndManifestBackground = async (req, res, next) => {
    try {

        const token = req?.shiprocketToken;

        const order = await Order.findById(req?.order?._id);
        if (!order || !order?.shipmentId) return;

        const shipmentId = order?.shipmentId;

        // Manifest
        const manifestRes = await axios.post(
            'https://apiv2.shiprocket.in/v1/external/manifests/generate',
            { shipment_id: [shipmentId] },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const manifestUrl = manifestRes.data?.manifest_url;

        // Label
        const labelRes = await axios.post(
            'https://apiv2.shiprocket.in/v1/external/courier/generate/label',
            { shipment_id: [shipmentId] },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const labelUrl = labelRes?.data?.label_url;
        console.log(labelRes?.data);

        // Update DB
        await Order.findByIdAndUpdate(
            order?._id,
            {
                shippingLabelUrl: labelUrl,
                shippingManifestUrl: manifestUrl
            }
        );
    } catch (err) {
        console.error('Background Label+Manifest error:', err?.response?.data || err);
        // retry once after delay
        // setTimeout(() => generateLabelAndManifestBackground(orderId, token), 30000); // retry after 30s
    }
}

const generateLabel = async (req, res) => {
    try {
        const { shipmentId } = req.body;
        const { shiprocketToken } = req;

        if (!shipmentId) {
            return res.status(400).json({ message: 'Shipment ID is required' });
        }

        const { data } = await axios.get(
            `https://apiv2.shiprocket.in/v1/external/courier/generate/label?shipment_id=${shipmentId}`,
            {
                headers: {
                    Authorization: `Bearer ${shiprocketToken}`,
                },
            }
        );

        const updatedOrder = await Order.findOneAndUpdate(
            { shipmentId },
            { shippingLabelUrl: data?.label_url },
            { new: true }
        );

        res.status(200).json({ success: true, url: data?.label_url });
    } catch (error) {
        console.error('Label Generation Error:', error);
        res.status(500).json({ success: false, message: 'Label generation failed' });
    }
};

const generateManifest = async (req, res) => {
    try {
        const { shipmentId } = req.body;
        const { shiprocketToken } = req;

        if (!shipmentId) {
            return res.status(400).json({ message: 'Shipment ID is required' });
        }

        const { data } = await axios.get(
            `https://apiv2.shiprocket.in/v1/external/manifests/generate?shipment_id=${shipmentId}`,
            {
                headers: {
                    Authorization: `Bearer ${shiprocketToken}`,
                },
            }
        );

        const updatedOrder = await Order.findOneAndUpdate(
            { shipmentId },
            { shippingManifestUrl: data?.manifest_url },
            { new: true }
        );

        res.status(200).json({ success: true, url: data?.manifest_url });
    } catch (error) {
        console.error('Manifest Generation Error:', error);
        res.status(500).json({ success: false, message: 'Manifest generation failed' });
    }
};

const checkPickupStatus = async (shipmentId, token) => {
    try {
        const response = await axios.get(
            `https://apiv2.shiprocket.in/v1/external/courier/track/shipment/${shipmentId}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        const data = response?.data;
        const status = data?.tracking_data?.shipment_track?.current_status;

        // Match any status indicating pickup is done
        // console.log("Pickup Data", data);
        const pickupCompleted = [
            'Pickup Completed',
            "PICKED UP",
            'In Transit',
            'Shipment picked up',
            'Delivered',
            'RTO'
        ]?.some((s) => status?.toLowerCase()?.includes(s?.toLowerCase()));

        return {
            completed: pickupCompleted,
            currentStatus: status,
        };
    } catch (err) {
        console.error('Error checking pickup status:', err?.response?.data || err);
        return {
            completed: false,
            error: true,
        };
    }
};

// Middleware to validate Shiprocket webhook token
const verifyShiprocketToken = (req, res, next) => {
    const receivedToken = req.headers['x-api-key'];
    const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;

    if (receivedToken !== expectedToken) {
        return res.status(403).json({ error: 'Unauthorized: Invalid token' });
    }

    next();
};

/* ------------------------------------------------------------------
   Shiprocket Webhook – handle post‑pickup events only
------------------------------------------------------------------- */
const shiprocketWebhook = asyncHandler(async (req, res) => {
    const p = req?.body;
    console.log("Shiprocket Webhook Response:", p);
    const srStatus = (p?.shipment_status || p?.current_status || "").toUpperCase();

    /* 2) Locate order -------------------------------------------------------- */
    const order = await Order.findOne({
        $or: [
            { awbCode: p?.awb },
            { shiprocketOrderId: String(p?.order_id || p?.sr_order_id) },
            { "returnData.order_id": String(p?.order_id) },  // match return order_id
            { "returnData.awb_code": p?.awb }
        ],
    });
    console.log("Found Order", order);
    if (!order) return res.status(200).json({ success: true, unknown: true });
    console.log("After Found Order", order);

    /* 4) Always overwrite scans if provided ---------------------------------- */
    if (Array.isArray(p?.scans) && p?.scans?.length) {
        await Order.findByIdAndUpdate(order._id, {
            scans: p?.scans,
            shippingStatus: srStatus
        }, { new: true }).exec();
    };

    /* 1) Ignore everything before PICKED UP ---------------------------------- */
    const postPickupStatuses = [
        "PICKED UP", "SHIPPED", "IN TRANSIT", "OUT FOR PICKUP", "DELIVERED",
        "CANCELED", "CANCELLED", "RETURN DELIVERED", "RETURN ACKNOWLEDGED",                      // late cancellation
        "RTO INITIATED", "RTO IN TRANSIT", "RTO", "RTO ACKNOWLEDGED"
    ];
    if (!postPickupStatuses.includes(srStatus))
        return res.status(200).json({ success: true, ignored: true });

    const prevShip = (order?.shippingStatus || "").toUpperCase();
    const nowISO = new Date().toISOString();
    const upd = { shippingStatus: srStatus };      // always store latest

    /* helper to restore stock exactly once */
    const restoreStock = async () => {
        if (order?._restockDone) return;
        for (const it of order?.items) {
            await Product.findByIdAndUpdate(it?.productId, {
                $inc: {
                    totalStock: it?.quantity,
                    [`variants.${it?.variantName}`]: it?.quantity,
                },
            }).exec();
        }
        upd._restockDone = true;
    };

    /* 3) Status‑specific logic ---------------------------------------------- */
    switch (srStatus) {
        case "PICKED UP":
            if (prevShip !== "PICKED UP") {
                upd.pickupDate = nowISO;
                if (["NEW", "ACCEPTED", "SHIPPED"].includes(order?.status?.toUpperCase()))
                    upd.status = "Shipped";
            }
            break;

        case "SHIPPED":
        case "IN TRANSIT":
        case "OUT FOR PICKUP":
            if (["NEW", "ACCEPTED", "SHIPPED"].includes(order?.status?.toUpperCase()))
                upd.status = "Shipped";
            break;

        case "DELIVERED":
            if (order.status !== "Delivered") {
                upd.status = "Delivered";
                upd.paymentStatus = "Paid";
                upd.deliveredAt = nowISO;
            }
            break;

        /* Late cancellation *after* pickup */
        case "CANCELED":
            if (["PICKED UP", "SHIPPED", "IN TRANSIT"].includes(prevShip) || order?.status != "Cancelled") {
                upd.status = "Cancelled";
                upd.reason = "Cancelled by courier after pickup";
                await restoreStock();
            }
            break;
        case "CANCELLED":
            if (["PICKED UP", "SHIPPED", "IN TRANSIT"].includes(prevShip) || order?.status != "Cancelled") {
                upd.status = "Cancelled";
                upd.reason = "Cancelled by courier after pickup";
                await restoreStock();
            }
            break;

        /* RTO journey */
        // case "RTO":
        // case "RTO IN TRANSIT":
        case "RTO INITIATED":
            if (!order?.rtoInitiatedAt) upd.rtoInitiatedAt = nowISO;
            // if (order?.status !== "Returned") upd.status = "Returned";
            break;

        case "RTO DELIVERED":
            upd.rtoDeliveredAt = nowISO;
            break;

        case "RETURN DELIVERED":
            upd.retrunDeliveredAt = nowISO;
            break;

        case "RTO ACKNOWLEDGED":
            upd.status = "Returned";
            await restoreStock();
            break;

        case "RETURN ACKNOWLEDGED":
            // upd.rtoDeliveredAt = nowISO;
            upd.status = "Returned";
            await restoreStock();
            break;

        default:
            // Any post‑pickup status we didn’t foresee: just record it.
            break;
    }

    /* 5) Persist if anything changed ---------------------------------------- */
    if (Object.keys(upd)?.length > 1) {             // >1 because shippingStatus always set
        await Order.findByIdAndUpdate(order?._id, upd, { new: true }).exec();
    }

    return res.status(200).json(new ApiResponse(200, null, "Webhook processed"));
});

export {
    assignBestCourier,
    schedulePickup,
    generateLabel,
    generateManifest,
    generateLabelAndManifestBackground,
    checkPickupStatus,
    shiprocketWebhook,
    verifyShiprocketToken
}