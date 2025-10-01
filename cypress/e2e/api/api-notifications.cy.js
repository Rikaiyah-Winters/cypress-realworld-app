const apiNotifications = `${Cypress.env("apiUrl")}/notifications`;

describe("Notifications API", () => {
    let ctx = {};
    before(() => {
        cy.request("GET", "/");
    });

    beforeEach(() => {
        cy.task("db:seed");

        cy.database("filter", "users").then((users) => {
            ctx.authenticatedUser = users[0];
            return cy.loginByApi(ctx.authenticatedUser.username);
        });

        cy.database("find", "transactions").then((transaction) => {
            ctx.transactionId = transaction.id;
        });

        cy.database("find", "notifications").then((notification) => {
            ctx.notification = notification.id;
        });

        cy.database("find", "likes").then((like) => {
            ctx.likeId = like.transactionId;
        });

        cy.database("find", "comments").then((comment) => {
            ctx.commentId = comment.transactionId;
        });
    });

    context("Retrieve /notifications", () => {
        it("gets a user's notification list", () => {
            cy.request("GET", `${apiNotifications}`).then((response) => {
                const notifs = response.body.results;

                expect(response.status).to.eq(200);
                expect(notifs.length).to.equal(8);
                notifs.forEach((noti) => {
                    expect(noti.isRead).to.be.false;
                    expect(noti.userId).to.eq(ctx.authenticatedUser.id);
                });
            });
        });
    });

    context("Create /notifications", () => {
        it("creates notifications for a transaction: payment, like, and comment", () => {
            cy.request("POST", `${apiNotifications}/bulk`, {
                items: [
                    {
                        type: "payment",
                        transactionId: ctx.transactionId,
                        status: "received",
                    },
                    {
                        type: "like",
                        transactionId: ctx.transactionId,
                        likeId: ctx.likeId,
                    },
                    {
                        type: "comment",
                        transactionId: ctx.transactionId,
                        commentId: ctx.commentId,
                    },
                ],
            }).then((response) => {
                const resp = response.body.results;
                expect(response.status).to.eq(200);
                expect(resp.length).to.equal(3);

                resp.forEach((noti) => {
                    expect(noti.id).to.be.a("string");
                    expect(noti.isRead).to.be.false;
                    expect(noti.transactionId).to.eq(ctx.transactionId);
                });
            });
        });
    });

    context("Update /notifications/:notificationId", () => {
        it("updates a notification", () => {
            cy.request("PATCH", `${apiNotifications}/${ctx.notification}`, {
                isRead: true,
            }).then((response) => {
                expect(response.status).to.eq(204);
            });
        });

        it("errors when invalid field sent", () => {
            cy.request({
                method: "PATCH",
                url: `${apiNotifications}/${ctx.notification}`,
                failOnStatusCode: false,
                body: {
                    notANotificationField: "Should throw error",
                },
            }).then((response) => {
                const resp = response.body.errors;

                expect(response.status).to.eq(422);
                expect(resp.length).to.eq(1);
                cy.log(resp[0].msg);
            });
        });

    })
});