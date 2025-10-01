describe("Notificaitons", () => {
    const ctx = {};

    beforeEach(function () {
        cy.task("db:seed");

        cy.intercept("GET", "/notifications*").as("getNotifications");
        cy.intercept("POST", "/transactions").as("createTransaction");
        cy.intercept("PATCH", "/notifications/*").as("updateNotification");
        cy.intercept("POST", "/comments/*").as("postComment");

        cy.database("filter", "users").then((users) => {
            ctx.userA = users[0];
            ctx.userB = users[1];
            ctx.userC = users[2];
        });
    });

    describe("User gets notifications from interactions on transactions", () => {
        it("A likes a transaction of B, and B gets a notification that A liked their transaction", () => {
            cy.loginByXstate(ctx.userA.username)
            cy.wait("@getNotifications");

            cy.database("find", "transactions", { senderId: ctx.userB.id }).then((transaction) => {
                cy.visit(`/transaction/${transaction.id}`)
            });

            cy.wait("@getNotifications").its("response.body.results.length").then((notificationCount) => {
                cy.dt("nav-top-notifications-count").should("have.text", `${notificationCount}`);
            });

            const likesCount = "[data-test*=transaction-like-count]";
            cy.contains(likesCount, 0);
            cy.dtl("like-button").click();
            cy.dtl("like-button").should("be.disabled");
            cy.contains(likesCount, 1);

            //log into B's account using XState
            cy.switchUserByXstate(ctx.userB.username);
            cy.wait("@getNotifications").its("response.body.results.length").as("preDismissedNotificationCount");
            cy.visit("/notifications");
            cy.wait("@getNotifications");
            cy.dtl("notification-list-item").should("have.length", 9).first().should("contain", ctx.userA.firstName).and("contain", "liked");
            cy.dtl("notification-mark-read").first().click({ force: true });
            cy.wait("@updateNotification");
            cy.get("@preDismissedNotificationCount").then((count) => {
                cy.dtl("notification-list-item").should("have.length.lessThan", Number(count));
            });
        });

        it("C likes a transaction between A and B, and A and B get notifications that C liked a transaction of thiers", () => {
            //sign in as C
            cy.loginByXstate(ctx.userC.username);
            cy.database("find", "transactions", { senderId: ctx.userA.id, receiverId: ctx.userB.id }).then((transaction) => {
                cy.visit(`/transaction/${transaction.id}`);
            });
            cy.dtl("like-count").contains(0);
            cy.dtl("like-button").click();
            cy.dtl("like-button").should("be.disabled");
            cy.dtl("like-count").contains(1);

            //switch to A by Xstate
            cy.switchUserByXstate(ctx.userA.username);
            cy.visit("/notifications");
            cy.wait("@getNotifications");
            cy.dtl("notification-list-item").should("have.length", 9).first().should("contain", ctx.userC.firstName).and("contain", "liked");

            //switch by xstate to B
            cy.switchUserByXstate(ctx.userB.username);
            cy.visit("/notifications");
            cy.wait("@getNotifications");
            cy.dtl("notification-list-item").should("have.length", 9).first().should("contain", ctx.userC.firstName).and("contain", "liked");
        });

        it("A comments on one of B's posts, and B gets a notification that A commented on one of thier transactions", () => {
            //login by xstate as A
            cy.loginByXstate(ctx.userA.username);
            cy.database("find", "transactions", { senderId: ctx.userB.id }).then((transaction) => {
                cy.visit(`/transaction/${transaction.id}`);
            });
            cy.dtl("comment-input").type("Test Message{enter}");
            cy.wait("@postComment");
            cy.dtl("comment-list-item").last().should("have.text", "Test Message");

            //switch to B by xstate
            cy.switchUserByXstate(ctx.userB.username);
            cy.visit("/notifications");
            cy.wait("@getNotifications");
            cy.dtl("notification-list-item").should("have.length", 9).first().should("contain", ctx.userA.firstName).and("contain", "commented");
        });

        it("C comments on a transaction between A and B, and A and B get notificaitons of it", () => {
            //login as C
            cy.loginByXstate(ctx.userC.username);
            cy.database("find", "transactions", { senderId: ctx.userA.id, receiverId: ctx.userB.id }).then((transaction) => {
                cy.visit(`/transaction/${transaction.id}`)
            });
            cy.dtl("comment-input").type("Test Message{enter}");
            cy.wait("@postComment");
            cy.dtl("comment-list-item").last().should("have.text", "Test Message");

            //switch to user A
            cy.switchUserByXstate(ctx.userA.username);
            cy.visit("/notifications");
            cy.wait("@getNotifications");
            cy.dtl("notification-list-item").should("have.length", 9).first().should("contain", ctx.userC.firstName).and("contain", "commented");

            //switch to user B
            cy.switchUserByXstate(ctx.userB.username);
            cy.visit("/notifications");
            cy.dtl("notification-list-item").should("have.length", 9).first().should("contain", ctx.userC.firstName).and("contain", "commented");
        })

        it("A sends payment to B, and B gets a notification", () => {
            //login as A by xstate
            cy.loginByXstate(ctx.userA.username);
            cy.dt("nav-top-new-transaction").click();
            cy.dt("user-list-search-input").type(ctx.userB.firstName);
            cy.dtl("user-list-item").first().should("contain", ctx.userB.firstName);
            cy.dtl("user-list-item").first().click();
            cy.dtl("create-amount-input").type("700");
            cy.dtl("create-description-input").type("For pain and suffering");
            cy.dtl("create-submit-payment").click();

            //switch to user B
            cy.switchUserByXstate(ctx.userB.username);
            cy.visit("/notifications");
            cy.dtl("notification-list-item").first().should("contain", ctx.userB.firstName).and("contain", "received payment");
        });

        it("A sends payment request to C, and C gets a notification", () => {
            //login in as A
            cy.loginByXstate(ctx.userA.username);
            cy.dt("nav-top-new-transaction").click();
            cy.dt("user-list-search-input").type(ctx.userC.firstName);
            cy.dtl("user-list-item").first().should("contain", ctx.userC.firstName);
            cy.dtl("user-list-item").first().click();
            cy.dtl("create-amount-input").type("18");
            cy.dtl("create-description-input").type("One pack of gum 🫧");
            cy.dtl("create-submit-request").click();

            //switch to user C
            cy.switchUserByXstate(ctx.userC.username);
            cy.visit("/notifications");
            cy.dtl("notification-list-item").first().should("contain", ctx.userA.firstName).and("contain", "requested payment");
        })

        it("renders empty notificaitons state", () => {
            cy.intercept("GET", "/notifications", []).as("notifications");

            cy.loginByXstate(ctx.userA.username);

            cy.dt("sidenav-notifications").click();
            cy.location("pathname").should("equal", "/notifications");
            cy.dt("notification-list").should("not.exist");
            cy.dt("empty-list-header").should("contain", "No Notifications");
        })
    })
});