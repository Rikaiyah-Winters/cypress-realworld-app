import Dinero from "dinero.js";
import { addDays, isWithinInterval, startOfDay } from "date-fns";
import { startOfDayUTC, endOfDayUTC } from "../../../src/utils/transactionUtils";
import { TransactionRequestStatus, TransactionStatus } from "../../../src/models";
import { isMobile } from "../../support/utils";

describe("Transaction Feed", () => {
    const ctx = {};

    const feedViews = {
        public: {
            tab: "public-tab",
            tabLabel: "everyone",
            routeAlias: "publicTransactions",
            service: "publicTransactionService",
        },
        contacts: {
            tab: "contacts-tab",
            tabLabel: "friends",
            routeAlias: "contactsTransactions",
            service: "contactTransactionService",
        },
        personal: {
            tab: "personal-tab",
            tabLabel: "mine",
            routeAlias: "personalTransactions",
            service: "personalTransactionService",
        },
    };

    beforeEach(() => {
        cy.task("db:seed");

        cy.intercept("GET", "/notifications").as("notifications");
        cy.intercept("GET", "/transactions*").as(feedViews.personal.routeAlias);
        cy.intercept("GET", "/transactions/public*").as(feedViews.public.routeAlias);
        cy.intercept("GET", "/transactions/contacts*").as(feedViews.contacts.routeAlias);

        cy.database("filter", "users").then((users) => {
            ctx.user = users[0];
            ctx.allUsers = users;

            cy.loginByXstate(ctx.user.username);
        });
    });

    describe("Tests side-nav responsiveness", () => {
        it("toggles the navigation column", function () {
            cy.wait("@notifications");
            cy.wait("@publicTransactions");
            if (isMobile()) {
                cy.dt("sidenav-home").should("not.exist");
                cy.dt("sidenav-toggle").click();
                cy.dt("sidenav-home").should("be.visible");
                cy.get(".MuiBackdrop-root").click({ force: true });
                cy.dt("sidenav-home").should("not.exist");
                cy.dt("sidenav-toggle").click();
                cy.dt("sidenav-home").click();
                cy.dt("sidenav-home").should("not.exist");
            } else {
                cy.dt("sidenav-home").should("be.visible");
                cy.dt("sidenav-toggle").click();
                cy.dt("sidenav-home").should("not.be.visible");
            };
        });
    });

    describe("App renders and paginates all transaction feeds", () => {
        it("Renders different transaction variations in feed", () => {
            cy.intercept("GET", "/transactions/public*", {
                headers: {
                    "X-Powered-By": "Express",
                    Date: new Date().toString(),
                },
                fixture: "public-transactions.json",
            }).as("mockedPublicTransactions");

            cy.visit("/");
            cy.wait("@mockedPublicTransactions").its("response.body.results").then((resTransactions) => {
                const resTransaction = (uiElement) => {
                    const uiTransactionId = uiElement.data("test").split("transaction-item-")[1];
                    return _.find(resTransactions, (transaction) => {
                        //gives access to mock transaction data via the id
                        return transaction.id === uiTransactionId;
                    });
                };

                cy.log("🧪 Testing a PAID Transaction Item");
                cy.contains("[data-test*='transaction-item']", "paid").within((element) => {
                    const dbTransaction = resTransaction(element);
                    const formattedAmount = Dinero({
                        amount: dbTransaction.amount,
                    }).toFormat();

                    expect([TransactionStatus.pending, TransactionStatus.complete]).to.include(dbTransaction.status);

                    expect(dbTransaction.requestStatus).to.be.empty;

                    cy.dtl("like-count").should("have.text", `${dbTransaction.likes.length}`);
                    cy.dtl("comment-count").should("have.text", `${dbTransaction.comments.length}`);

                    cy.dtl("sender").should("contain", dbTransaction.senderName);
                    cy.dtl("receiver").should("contain", dbTransaction.receiverName);

                    cy.dtl("amount")
                    .should("contain", `-${formattedAmount}`)
                    .should("have.css", "color", "rgb(255, 0, 0)");
                });

                cy.log("🧪 Testing a REQUEST payment that HAS BEEN CHARGED");
                cy.contains("[data-test*='transaction-item']", "charged").within((element) => {
                    const dbTransaction = resTransaction(element);
                    const formattedAmount = Dinero({
                        amount: dbTransaction.amount,
                    }).toFormat();

                    expect(TransactionStatus.complete).to.equal(dbTransaction.status);

                    //flipped these
                    expect(TransactionRequestStatus.accepted).to.equal(dbTransaction.requestStatus);

                    cy.dtl("amount")
                    .should("contain", `+${formattedAmount}`)
                    .should("have.css", "color", "rgb(76, 175, 80)");
                });

                cy.log("🧪 Testing a REQUEST Transaction Item");
                cy.contains("[data-test*='transaction-item']", "requested").within((element) => {
                    const dbTransaction = resTransaction(element);
                    const formattedAmount = Dinero({
                        amount: dbTransaction.amount,
                    }).toFormat();

                    expect([TransactionStatus.pending, TransactionStatus.complete]).to.include(dbTransaction.status);

                    expect([TransactionRequestStatus.pending, TransactionRequestStatus.rejected]).to.include(dbTransaction.requestStatus);

                    cy.dtl("amount")
                    .should("contain", `+${formattedAmount}`)
                    .should("have.css", "color", "rgb(76, 175, 80)");
                });
            });
        });

        _.each(feedViews, (feed, feedName) => {
            it(`paginates ${feedName} transaction feed`, function () {
                cy.dtl(feed.tab).click();
                cy.dtl(feed.tab)
                .should("have.class", "Mui-selected")
                .contains(feed.tabLabel, { matchCase: false })
                .should("have.css", { "text-transform": "uppercase" });

                cy.dt("list-skeleton").should("not.exist");

                cy.wait(`@${feed.routeAlias}`)
                .its("response.body.results")
                .should("have.length", Cypress.env("paginationPageSize"));

                cy.dt("transaction-list").children().scrollTo("bottom");

                cy.wait(`@${feed.routeAlias}`).its("response.body").then(({ results, pageData }) => {
                    expect(results).have.length(Cypress.env("paginationPageSize"));
                    expect(pageData.page).to.equal(2);
                    //move window to last page
                    cy.nextTransactionFeedPage(feed.service, pageData.totalPages);
                });

                //ensures you're on the last pageData.page
                cy.wait(`@${feed.routeAlias}`).its("response.body").then(({ results, pageData }) => {
                    expect(results).to.have.length.least(1);
                    expect(pageData.page).to.equal(pageData.totalPages);
                    expect(pageData.hasNextPages).to.equal(false);
                });
            });
        });
    });

    describe("filters transaction feed by date range", () => {
        //insert mobile section here
        _.each(feedViews, (feed, feedName) => {
            it(`filters ${feedName} transaction feed by date range`, () => {
                cy.database("find", "transactions").then((transaction) => {
                    const dateRangeStart = startOfDay(new Date(transaction.createdAt));
                    const dateRangeEnd = endOfDayUTC(addDays(dateRangeStart, 1));

                    cy.dtl(feed.tab).click();
                    cy.dtl(feed.tab).should("have.class", "Mui-selected");

                    cy.wait(`@${feed.routeAlias}`).its("response.body.results").as("unfilteredResults");

                    cy.pickDateRange(dateRangeStart, dateRangeEnd);

                    cy.wait(`@${feed.routeAlias}`).its("response.body.results").then((transactions) => {
                        cy.dtl("transaction-item").should("have.length", transactions.length);

                        transactions.forEach(({ createdAt }) => {
                            const createdAtDate = startOfDayUTC(new Date(createdAt));
                            expect(isWithinInterval(createdAtDate, {
                                start: startOfDayUTC(dateRangeStart),
                                end: dateRangeEnd,
                            }), 
                                `transaction created date (${createdAtDate.toISOString()}) is within ${dateRangeStart.toISOString()}
                            and ${dateRangeEnd.toISOString()}`
                            ).to.equal(true);
                        });
                    });

                    cy.dtl("filter-date-clear-button").click({ force: true });
                    cy.dtl("filter-date-range-button").should("contain", "ALL");

                    cy.get("@unfilteredResults").then((unfilteredResults) => {
                        cy.wait(`@${feed.routeAlias}`)
                        .its("response.body.results")
                        .should("deep.equal", unfilteredResults);
                    });
                });
            });

            it(`does not show ${feedName} transactions for out of range limits`, () => {
                const dateRangeStart = startOfDay(new Date(2014, 1, 1));
                const dateRangeEnd = endOfDayUTC(addDays(dateRangeStart, 1));

                cy.dtl(feed.tab).click();
                cy.wait(`@${feed.routeAlias}`);

                cy.pickDateRange(dateRangeStart, dateRangeEnd);
                cy.wait(`@${feed.routeAlias}`);

                cy.dtl("transaction-item").should("have.length", 0);
                cy.dt("empty-list-header").should("contain", "No Transactions");

                cy.dtl("empty-create-transaction-button")
                .should("have.attr", "href", "/transaction/new")
                .contains("create a transaction", { matchCase: false })
                .should("have.css", { "text-transform": "uppercase" });
            });
        });
    });

    describe("filters transaction feed by amount range", () => {
        const dollarAmountRange = {
            min: 200,
            max: 800,
        }

        _.each(feedViews, (feed, feedName) => {
            it(`filters ${feedName} transaction feed by amount range`, () => {
                cy.dtl(feed.tab).click({ force: true });
                cy.dtl(feed.tab).should("have.class", "Mui-selected");

                cy.wait(`@${feed.routeAlias}`).its("response.body.results").as("unfilteredResults");

                cy.setTransactionAmountRange(dollarAmountRange.min, dollarAmountRange.max);
                cy.dtl("filter-amount-range-text").should("contain", `$${dollarAmountRange.min} - $${dollarAmountRange.max}`);

                cy.wait(`@${feed.routeAlias}`).then(({ response: { body, url } }) => {
                    const transactions = body.results;
                    const urlParams = new URLSearchParams(_.last(url.split("?")));
                    const rawAmountMin = dollarAmountRange.min * 100;
                    const rawAmountMax = dollarAmountRange.max * 100;

                    expect(urlParams.get("amountMin")).to.equal(`${rawAmountMin}`);
                    expect(urlParams.get("amountMax")).to.equal(`${rawAmountMax}`);

                    transactions.forEach(({ amount }) => {
                        expect(amount).to.be.within(rawAmountMin, rawAmountMax);
                    });
                });

                cy.dtl("amount-clear-button").click();

                //isMobile section

                cy.get("@unfilteredResults").then((unfilteredResults) => {
                    cy.wait(`@${feed.routeAlias}`)
                    .its("response.body.results")
                    .should("deep.equal", unfilteredResults);
                });
            });

            it(`does not show ${feedName} transactions for out of range amounts`, () => {
                cy.dtl(feed.tab).click();
                cy.wait(`@${feed.routeAlias}`);

                cy.setTransactionAmountRange(550, 1000);
                cy.dtl("filter-amount-range-text").should("contain", "$550 - $1,000");
                cy.wait(`@${feed.routeAlias}`);
                cy.dtl("transaction-item").should("have.length", 0);
                cy.dt("empty-list-header").should("contain", "No Transactions");

                cy.dtl("empty-create-transaction-button")
                .should("have.attr", "href", "/transaction/new")
                .contains("create a transaction", { matchCase: false })
                .should("have.css", { "text-transform": "uppercase" });
            });
        });
    });

    describe("Each feed shows correct types of transactions", () => {
        it("MINE feed only shows personal transactions", () => {
            cy.dtl(feedViews.personal.tab).click();
            cy.wait("@personalTransactions").its("response.body.results").each((transaction) => {
                const transactionParticipants = [transaction.senderId, transaction.receiverId];
                expect(transactionParticipants).to.include(ctx.user.id);
            });
            cy.dt("list-skeleton").should("not.exist");
        });

        it("First five Public Feed items belong to Contacts", () => {
            cy.database("filter", "contacts", { userId: ctx.user.id }).then((contacts) => {
                ctx.contactIds = contacts.map((contact) => contact.contactUserId);
            });

            cy.wait("@publicTransactions").its("response.body.results").invoke("slice", 0, 5).each((transaction) => {
                const transactionParticipants = [transaction.senderId, transaction.receiverId];
                const contactsInTransaction = _.intersection(transactionParticipants, ctx.contactIds);
                const message = `"${contactsInTransaction}" is a contact of ${ctx.user.id}`;
                expect(contactsInTransaction, message).to.not.be.empty;
            });
            cy.dt("list-skeleton").should("not.exist");
        });

        it("friends feed only shows contact transactions", () => {
            cy.database("filter", "contacts", { userId: ctx.user.id }).then((contacts) => {
                ctx.contactIds = contacts.map((contact) => contact.contactUserId);
            });
            cy.dtl(feedViews.contacts.tab).click()

            cy.wait("@contactsTransactions").its("response.body.results").each((transaction) => {
                const transactionParticipants = [transaction.senderId, transaction.receiverId];
                const contactsInTransaction = _.intersection(transactionParticipants, ctx.contactIds);
                const message = `"${contactsInTransaction}" is a contact of ${ctx.user.id}`;
                expect(contactsInTransaction, message).to.not.be.empty;
            });
            cy.dt("list-skeleton").should("not.exist");
        });
    });
});