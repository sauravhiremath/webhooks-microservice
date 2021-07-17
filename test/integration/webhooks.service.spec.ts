"use strict";

import { ServiceBroker } from "moleculer";
import TestService from "../../services/webhooks.service";

describe("Test 'webhooks' service", () => {
	describe("Test webhooks", () => {
		const broker = new ServiceBroker({ logger: false });
		const service = broker.createService(TestService);
		service.seedDB = null; // Disable seeding

		beforeAll(() => broker.start());
		afterAll(() => broker.stop());

		const record = {
			targetUrl: "http://example.com",
		};
		let newID: string;

		it("should contains the seeded items", async () => {
			const res = await broker.call("webhooks.list");
			expect(res).toEqual({
				page: 1,
				pageSize: 10,
				rows: [],
				total: 0,
				totalPages: 0,
			});
		});

		it("should add the new item", async () => {
			const res: any = await broker.call("webhooks.create", record);
			expect(res).toEqual({
				_id: expect.any(String),
				targetUrl: "http://example.com",
			});
			newID = res._id;

			const res2 = await broker.call("webhooks.count");
			expect(res2).toBe(1);
		});

		it("should get the saved item", async () => {
			const res = await broker.call("webhooks.get", { id: newID });
			expect(res).toEqual({
				_id: expect.any(String),
				targetUrl: "http://example.com",
			});

			const res2 = await broker.call("webhooks.list");
			expect(res2).toEqual({
				page: 1,
				pageSize: 10,
				rows: [
					{
						_id: newID,
						targetUrl: "http://example.com",
					},
				],
				total: 1,
				totalPages: 1,
			});
		});

		it("should update an item", async () => {
			const res = await broker.call("webhooks.update", {
				id: newID,
				targetUrl: "http://new-example.com",
			});
			expect(res).toEqual({
				_id: expect.any(String),
				targetUrl: "http://new-example.com",
			});
		});

		it("should get the updated item", async () => {
			const res = await broker.call("webhooks.get", { id: newID });
			expect(res).toEqual({
				_id: expect.any(String),
				targetUrl: "http://new-example.com",
			});
		});

		it("should send triggers for urls", async () => {
			const res = await broker.call("webhooks.trigger");
			expect(res).toEqual({
				success: true,
				message: expect.any(String),
				data: expect.any(Array),
			});
		});

		it("should remove the updated item", async () => {
			const res = await broker.call("webhooks.remove", { id: newID });
			expect(res).toBe(1);

			const res2 = await broker.call("webhooks.count");
			expect(res2).toBe(0);

			const res3 = await broker.call("webhooks.list");
			expect(res3).toEqual({
				page: 1,
				pageSize: 10,
				rows: [],
				total: 0,
				totalPages: 0,
			});
		});
	});
});
