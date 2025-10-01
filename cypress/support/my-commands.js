import { format as formatDate } from "date-fns";

Cypress.Commands.add("dt", (attr) => {
  return cy.get(`[data-test=${attr}]`);
})

Cypress.Commands.add("dtl", (attr) => {
  return cy.get(`[data-test*=${attr}]`);
})

Cypress.Commands.add("login", (username, password) => {
  cy.visit("/signin");
  cy.dt("signin-username").type(username);
  cy.dt("signin-password").type(password);
  cy.dt("signin-submit").click();
  cy.url().should("contain", "/");
})

Cypress.Commands.add("database", (operation, entity, query, logTask = false) => {
  const params = {
    entity,
    query,
  };

  return cy.task(`${operation}:database`, params, { log: logTask }).then((data) => {
    return data;
  });
})

Cypress.Commands.add("loginByXstate", (username, password = Cypress.env("defaultPassword")) => {
  cy.intercept("POST", "/login").as("loginUser");
  // cy.intercept("GET", "/checkAuth").as("getUserProfile");
  cy.visit("/signin", { log: false });
  cy.window().then((win) => win.authService.send("LOGIN", { username, password }));
  cy.wait("@loginUser");
  return cy.dt("list-skeleton").should("not.exist");
})

Cypress.Commands.add("logoutByXstate", () => {
  cy.window({ log: false }).then((win) => {
    win.authService.send("LOGOUT");
  });

  return cy.location("pathname").should("equal", "/signin");
});

Cypress.Commands.add("switchUserByXstate", (username) => {
  cy.logoutByXstate();
  cy.loginByXstate(username);
  //return to tend to mobile needs
  /* if (isMobile()) {
    cy.getBySel("sidenav-toggle").click();
    cy.getBySel("sidenav-username").contains(username);
    cy.getBySel("sidenav-toggle").click({ force: true });
  } */
  cy.dt("sidenav-username").contains(username);

  cy.dt("list-skeleton").should("not.exist");
  cy.dtl("transaction-item").should("have.length.greaterThan", 1);
});

Cypress.Commands.add("nextTransactionFeedPage", (service, page) => {
  return cy.window({ log: false }).then((win) => {
    return win[service].send("FETCH", { page });
  });
});

Cypress.Commands.add("pickDateRange", (startDate, endDate) => {
  const selectDate = (date) => {
    return cy.get(`[data-date='${formatDate(date, "yyyy-MM-dd")}']`).click({ force: true });
  };
  cy.clock(startDate.getTime(), ["Date"]);
  // Open date range picker
  cy.dtl("filter-date-range-button").click({ force: true });
  cy.get(".Cal__Header__root").should("be.visible");
  // Select date range
  selectDate(startDate);
  selectDate(endDate);
  cy.get(".Cal__Header__root").should("not.exist");
});

Cypress.Commands.add("reactComponent", { prevSubject: "element" }, (element) => {
  if (element.length !== 1) {
    throw new Error(`cy.component() requires element of length 1 but got ${element.length}`);
  }
  // Query for key starting with __reactInternalInstance$ for React v16.x
  const key = Object.keys(element.get(0)).find((key) => key.startsWith("__reactFiber$"));
  const domFiber = element.prop(key);

  return domFiber.return;
});

Cypress.Commands.add("setTransactionAmountRange", (min, max) => {
  cy.dt("transaction-list-filter-amount-range-button").scrollIntoView();
  cy.dt("transaction-list-filter-amount-range-button").click({ force: true });

  return cy.dtl("filter-amount-range-slider").reactComponent().its("memoizedProps").its("ownerState").invoke("onChange", null, [min / 10, max / 10]);
});

Cypress.Commands.add("loginByApi", (username, password = Cypress.env("defaultPassword")) => {
  return cy.request("POST", `${Cypress.env("apiUrl")}/login`, {
    username,
    password,
  });
})