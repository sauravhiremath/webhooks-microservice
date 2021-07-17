import { Router, Request, Response } from "express";
import fetch from "node-fetch";
import { WEBHOOK_HOST } from "../config";

const router: Router = Router();

enum CustomErrors {
	INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
}

router.post("/ip", async (req: Request, res: Response) => {
	try {
		const clientIp =
			req.headers["x-forwarded-for"] || req.socket.remoteAddress;
		const result = await fetch(`${WEBHOOK_HOST}/trigger`, {
			method: "POST",
			body: JSON.stringify({ ipAddress: clientIp }),
			headers: {
				"authorization": req.headers.authorization,
				"Content-Type": "application/json",
			},
		});
		if (!result.ok) {
			return res.json({ success: false, error: await result.json() });
		}
		return res.json({ success: true, data: await result.json() });
	} catch (error) {
		return res.json({
			success: false,
			error: CustomErrors.INTERNAL_SERVER_ERROR,
		});
	}
});

router.post("/register", async (req: Request, res: Response) => {
	try {
		const { targetUrl } = req.body;
		const result = await fetch(`${WEBHOOK_HOST}/register`, {
			method: "POST",
			body: JSON.stringify({ targetUrl }),
			headers: {
				"authorization": req.headers.authorization,
				"Content-Type": "application/json",
			},
		});
		if (!result.ok) {
			return res.json({ success: false, error: await result.json() });
		}
		return res.json({ success: true, data: await result.json() });
	} catch (error) {
		console.warn(error);
		return res.json({
			success: false,
			error: CustomErrors.INTERNAL_SERVER_ERROR,
		});
	}
});

router.post("/update", async (req: Request, res: Response) => {
	try {
		const { id, newTargetUrl } = req.body;
		const result = await fetch(`${WEBHOOK_HOST}/update/${id}`, {
			method: "PUT",
			body: JSON.stringify({ targetUrl: newTargetUrl }),
			headers: {
				"authorization": req.headers.authorization,
				"Content-Type": "application/json",
			},
		});
		if (!result.ok) {
			return res.json({ success: false, error: await result.json() });
		}
		return res.json({ success: true, data: await result.json() });
	} catch (error) {
		return res.json({
			success: false,
			error: CustomErrors.INTERNAL_SERVER_ERROR,
		});
	}
});

router.post("/delete", async (req: Request, res: Response) => {
	try {
		const { id } = req.body;
		const result = await fetch(`${WEBHOOK_HOST}/delete/${id}`, {
			method: "DELETE",
			headers: {
				"authorization": req.headers.authorization,
				"Content-Type": "application/json",
			},
		});
		if (!result.ok) {
			return res.json({ success: false, error: await result.json() });
		}
		return res.json({ success: true, data: await result.json() });
	} catch (error) {
		return res.json({
			success: false,
			error: CustomErrors.INTERNAL_SERVER_ERROR,
		});
	}
});

router.get("/list", async (req: Request, res: Response) => {
	try {
		const result = await fetch(`${WEBHOOK_HOST}/list`, {
			method: "GET",
			headers: { authorization: req.headers.authorization },
		});
		if (!result.ok) {
			return res.json({ success: false, error: await result.json() });
		}
		return res.json({ success: true, data: await result.json() });
	} catch (error) {
		return res.json({
			success: false,
			error: CustomErrors.INTERNAL_SERVER_ERROR,
		});
	}
});

export default router;
