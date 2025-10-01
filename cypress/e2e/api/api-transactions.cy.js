import { faker } from "@faker-js/faker";
import { isEqual } from "lodash/fp";

const getFakeAmount = () => parseInt(faker.finance.amount(), 10);
const apiTransactions = `${Cypress.env("apiUrl")}/transactions`;

describe("Transactions API", () => {
    let ctx = {};

    before(() => {
        cy.request("GET", "/");
    });

    const isSenderOrReceiver = ({ senderId, receiverId }) =>
        isEqual(senderId, ctx.authenticatedUser.id) || isEqual(receiverId, ctx.authenticatedUser.id);

    beforeEach(() => {
        cy.task("db:seed");

        cy.database("filter", "users").then((users) => {
            ctx.authenticatedUser = users[0];
            ctx.receiver = users[1];

            return cy.loginByApi(ctx.authenticatedUser.username);
        });

        cy.database("find", "transactions").then((transaction) => {
            ctx.transactionId = transaction.id;
        });

        cy.database("find", "notifications").then((notification) => {
            ctx.notificationId = notification.id;
        });

        cy.database("find", "bankaccounts").then((bankaccount) => {
            ctx.bankAccountId = bankaccount.id;
        });
    });

    context("GET /transactions", () => {
        it("gets a list of transactions for user ", () => {
            cy.request("GET", `${apiTransactions}`).then((response) => {
                const resp = response.body.results;
                expect(response.status).to.eq(200);

                resp.forEach((trans) => {
                    expect(trans).to.satisfy(isSenderOrReceiver);
                    expect(trans.status).to.be.oneOf(["complete", "pending"]);
                    expect(trans.requestStatus).to.not.eq("accepted");
                    expect(trans.description).to.include(ctx.authenticatedUser.id);
                });
            });
        });

        it("gets a list of accepted request transactions for user", () => {
            cy.request({
                method: "GET",
                url: `${apiTransactions}`,
                qs: {
                    requestStatus: "accepted"
                },
            }).then((response) => {
                const resp = response.body.results;
                expect(response.status).to.eq(200);

                resp.forEach((trans) => {
                    expect(trans).to.satisfy(isSenderOrReceiver);
                    expect(trans.status).to.eq("complete");
                    expect(trans.requestStatus).to.not.eq("rejected");
                    expect(trans.description).to.include(ctx.authenticatedUser.id)
                });

            });
        });

        it("gets a list of rejected request transactions for user between a time range", () => {
            cy.request({
                method: "GET",
                url: `${apiTransactions}`,
                qs: {
                    requestStatus: "rejected",
                    dateRangeStart: new Date("Jan 01 2018"),
                    dateRangeEnd: new Date("Dec 05 2030"),
                },
            }).then((response) => {
                const resp = response.body.results;
                expect(response.status).to.eq(200);

                resp.forEach((trans) => {
                    expect(trans).to.satisfy(isSenderOrReceiver);
                    expect(trans.status).to.eq("complete");
                    expect(trans.description).to.include("Request");
                    expect(trans.requestStatus).to.not.eq("accepted");
                });
            });
        });
    });

    context("GET /transactions/contacts", () => {
        it("gets a list of transactions for users contacts: page one", () => {
            cy.request("GET", `${apiTransactions}/contacts`).then((response) => {
                const resp = response.body.results;
                expect(response.status).to.eq(200);
                expect(response.body.results.length).to.eq(10);

                resp.forEach((trans) => {
                    expect(trans).to.not.satisfy(isSenderOrReceiver);
                    expect(trans.description).to.not.include(ctx.authenticatedUser.id);
                });
            });
        });

        it("gets a list of transactions for users contacts: page two", () => {
            cy.request("GET", `${apiTransactions}/contacts?page=2`).then((response) => {
                const resp = response.body.results;
                expect(response.status).to.eq(200);
                expect(response.body.results.length).to.eq(10);

                resp.forEach((trans) => {
                    expect(trans).to.not.satisfy(isSenderOrReceiver);
                    expect(trans.description).to.not.include(ctx.authenticatedUser.id);
                });
            });
        });
    });

    context("GET /transactions/public", () => {
        it('gets a list of public transactions', () => {
            cy.request("GET", `${apiTransactions}/public`).then((response) => {
                const resp = response.body.results;

                expect(response.status).to.eq(200);
                expect(resp).length.to.be.greaterThan(1);
                expect(resp.length).to.eq(10);
            });
        });
    });

    context("POST /transactions", () => {
        it("creates a new payment", () => {
            cy.request("POST", `${apiTransactions}`, {
                transactionType: "payment",
                source: ctx.bankAccountId,
                receiverId: ctx.receiver.id,
                description: `Payment: ${ctx.authenticatedUser.id} to ${ctx.receiver.id}`,
                amount: getFakeAmount(),
                privacyLevel: "public",
            }).then((response) => {
                const resp = response.body.transaction;

                expect(response.status).to.eq(200);
                expect(resp.id).to.be.a("string");
                expect(resp.status).to.eq("complete");
                expect(resp.requestStatus).to.eq(undefined);
                expect(resp.uuid).to.be.a("string");
                expect(resp.senderId).to.eq(ctx.authenticatedUser.id);
                expect(resp.amount).to.be.a("number");
            });
        });

        it("creates a new request", () => {
            cy.request("POST", `${apiTransactions}`, {
                transactionType: "request",
                source: ctx.bankAccountId,
                receiverId: ctx.receiver.id,
                description: `Request: ${ctx.authenticatedUser.id} from ${ctx.receiver.id}`,
                amount: getFakeAmount(),
                privacyLevel: "public",
            }).then((response) => {
                const resp = response.body.transaction;

                expect(response.status).to.eq(200);
                expect(resp.id).to.be.a("string");
                expect(resp.status).to.eq("pending");
                expect(resp.requestStatus).to.eq("pending");
                expect(resp.uuid).to.be.a("string");
                expect(resp.senderId).to.eq(ctx.authenticatedUser.id);
                expect(resp.amount).to.be.a("number");
            });
        });
    });

    context("PATCH /transactions/:transactionId", () => {
        it("updates a transaction", () => {
            cy.request("PATCH", `${apiTransactions}/${ctx.transactionId}`, {
                requestStatus: "rejected",
            }).then((response) => {
                expect(response.status).to.eq(204);
                expect(response.body).to.eq(undefined);
            });
        });

        it("errors when an invalid field is sent", () => {
            cy.request({
                method: "PATCH",
                url: `${apiTransactions}/${ctx.transactionId}`,
                failOnStatusCode: false,
                body: {
                    notATransactionField: "not a transaction field",
                },
            }).then((response) => {
                expect(response.status).to.eq(422);
                expect(response.body.errors.length).to.eq(1);
                cy.log(response.body.errors[0].msg);
            });
        });
    });
});