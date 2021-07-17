"use strict";

import { Context, Errors, ServiceBroker } from "moleculer";
import TestService from "../../../services/webhooks.service";

describe("Test 'webhooks' service", () => {
	describe("Test actions", () => {
		const broker = new ServiceBroker({ logger: false });
		const service = broker.createService(TestService);

		jest.spyOn(service.adapter, "updateById");
		jest.spyOn(service, "transformDocuments");
		jest.spyOn(service, "entityChanged");

		beforeAll(() => broker.start());
		afterAll(() => broker.stop());

		const record = {
			_id: "123",
			targetUrl: "http://example.com",
		};

		describe("Test 'webhooks.trigger'", () => {
			it("should fail to send the http triggers", async () => {
				service.adapter.updateById.mockImplementation(
					async () => record
				);
				service.transformDocuments.mockClear();
				service.entityChanged.mockClear();

				try {
					const res = await broker.call("webhooks.trigger");
					expect(res).toStrictEqual({
						success: true,
						message: expect.any(String),
						data: expect.any(Array),
					});
				} catch (error) {
					expect(error.message).toBe(
						"Webhooks bulk targetUrls trigger failed"
					);
				}
			});
		});
	});

	describe("Test methods", () => {
		const broker = new ServiceBroker({ logger: false });
		const service = broker.createService(TestService);

		jest.spyOn(service.adapter, "insertMany");
		jest.spyOn(service, "seedDB");

		beforeAll(() => broker.start());
		afterAll(() => broker.stop());

		describe("Test 'seedDB'", () => {
			it("should be called after service started & DB connected", async () => {
				expect(service.seedDB).toBeCalledTimes(1);
				expect(service.seedDB).toBeCalledWith();
			});

			it("should insert 3 documents", async () => {
				expect(service.adapter.insertMany).toBeCalledTimes(1);
				expect(service.adapter.insertMany).toBeCalledWith([
					{ targetUrl: "https://sauravmh.com" },
					{ targetUrl: "https://blog.sauravmh.com" },
					{ targetUrl: "https://fifa.sauravmh.com" },
				]);
			});
		});
	});

	describe("Test hooks", () => {
		const broker = new ServiceBroker({ logger: false });
		const createActionFn = jest.fn();
		// @ts-ignore
		broker.createService(TestService, {
			actions: {
				create: {
					handler: createActionFn,
				},
			},
		});

		beforeAll(() => broker.start());
		afterAll(() => broker.stop());
	});
});
