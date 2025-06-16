import axios from "axios";
import { Order } from "../models/order.model.js";

// This function should be used right after order creation in Shiprocket
// controllers/assignBestCourier.js
const assignBestCourier = async (req, res, next) => {
    try {
        const { shipmentId } = req.order;
        const token = req.shiprocketToken;

        if (!shipmentId)
            return res.status(400).json({
                success: false,
                message: "Shipment ID missing"
            });

        // Skip if already assigned
        const freshOrder = await Order.findById(req.order._id);
        if (freshOrder.awbCode) return next();

        const { data } = await axios.post(
            "https://apiv2.shiprocket.in/v1/external/courier/assign/awb",
            { shipment_id: shipmentId },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        let awbCode = null;
        let courierName = null;

        if (data.awb_assign_status === 1 && data.response?.data?.awb_code) {
            awbCode = data.response.data.awb_code;
            courierName = data.response.data.courier_name;
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

        // Update DB
        await Order.findByIdAndUpdate(
            req.order._id,
            {
                awbCode,
                courierName,
                courierAssignedAt: new Date(),
                shippingStatus: "Courier Assigned",
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
        const { shipmentId } = req.order;
        const token = req.shiprocketToken;

        if (!shipmentId)
            return res.status(400).json({
                success: false,
                message: "Shipment ID missing"
            });

        const freshOrder = await Order.findById(req.order._id);
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
        await Order.findByIdAndUpdate(
            req.order._id,
            {
                pickupScheduled: true,
                pickupTokenNumber,
                pickupDate,
                pickupSlot: pickupSlot || null,
                // status: "Shipped",
                shippingStatus: "Pickup Scheduled",
                expectedDeliveryDate: trackData?.data?.tracking_data?.etd || null
            },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: "Pickup scheduled successfully",
            data: data,
            pickupDate,
            pickupSlot: pickupSlot || null,
        });
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

export {
    assignBestCourier,
    schedulePickup,
    generateLabel,
    generateManifest,
    generateLabelAndManifestBackground
}