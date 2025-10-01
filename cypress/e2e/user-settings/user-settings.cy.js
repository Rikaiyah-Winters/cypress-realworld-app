import { isMobile } from "../../support/utils";

describe("User Settings tests", () => {
    beforeEach(() => {
        cy.task("db:seed");
        cy.intercept("PATCH", "/users/*").as("updateUser");
        cy.intercept("GET", "/notifications*").as("getNotifications");
        cy.database("find", "users", { username: "Dina20" }).then((user) => {
            cy.loginByXstate(user.username);
        });
        if (isMobile()) {
            cy.getBySel("sidenav-toggle").click();
        }
        cy.dt("sidenav-user-settings").click();
    });

    it("User Settings form is Displayed", () => {
        cy.wait("@getNotifications");
        cy.dt("user-settings-form").should("be.visible");
        cy.url().should("contain", "/user/settings");
    });


    it("Updates user info", () => {
        const updatedUserInfo = {
            firstName: "John",
            lastName: "Dough",
            email: "hynjinfan97@gmail.com",
            phone: "601-630-8004",
        };

        cy.dtl("firstName-input").clear();
        cy.dtl("firstName-input").type(updatedUserInfo.firstName);
        cy.dtl("lastName-input").clear();
        cy.dtl("lastName-input").type(updatedUserInfo.lastName);
        cy.dtl("email-input").clear();
        cy.dtl("email-input").type(updatedUserInfo.email);
        cy.dtl("phoneNumber-input").clear();
        cy.dtl("phoneNumber-input").type(updatedUserInfo.phone);
        cy.dtl("submit").click();
        cy.wait("@updateUser").its("response.statusCode").should("equal", 204);
        if (isMobile()) {
            cy.getBySel("sidenav-toggle").click();
        }
        cy.dt("sidenav-user-full-name").should("contain", updatedUserInfo.firstName);
    });


    it("Displays individual errors on user settings update form", () => {
        //first name
        cy.dtl("firstName-input").clear();
        cy.dtl("firstName-input").blur();
        cy.get("#user-settings-firstName-input-helper-text")
        .should("be.visible")
        .and("have.text", "Enter a first name");

        cy.dtl("lastName-input").clear();
        cy.dtl("lastName-input").blur();
        cy.get("#user-settings-lastName-input-helper-text")
        .should("be.visible")
        .and("have.text", "Enter a last name");

        cy.dtl("email-input").clear();
        cy.dtl("email-input").blur();
        cy.get("#user-settings-email-input-helper-text")
        .should("be.visible")
        .and("have.text", "Enter an email address");
        cy.dtl("email-input").type("hynjinfan97@gmail.");
        cy.get("#user-settings-email-input-helper-text")
        .should("be.visible")
        .and("have.text", "Must contain a valid email address");

        cy.dtl("phoneNumber-input").clear();
        cy.dtl("phoneNumber-input").blur();
        cy.get("#user-settings-phoneNumber-input-helper-text")
        .should("be.visible")
        .and("have.text", "Enter a phone number");
        cy.dtl("phoneNumber-input").clear();

        //needs 9-10 digits w/ dashes
        cy.dtl("phoneNumber-input").type("601-630-80");
        cy.get("#user-settings-phoneNumber-input-helper-text")
        .should("be.visible")
        .and("have.text", "Phone number is not valid");
        cy.dtl("phoneNumber-input").clear();

        cy.dtl("phoneNumber-input").type("601-630-80890");
        cy.get("#user-settings-phoneNumber-input-helper-text")
        .should("be.visible")
        .and("have.text", "Phone number is not valid");
        cy.dtl("phoneNumber-input").clear();

        //needs more than 5 digits w/o dashes
        cy.dtl("phoneNumber-input").type("60163");
        cy.get("#user-settings-phoneNumber-input-helper-text")
        .should("be.visible")
        .and("have.text", "Phone number is not valid");
        cy.dtl("submit").should("be.disabled");
    });

    //add to phone number test to add a letter and it's supposed to say phone number not valid
});