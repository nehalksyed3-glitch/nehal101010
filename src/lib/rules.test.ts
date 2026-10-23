import { beforeEach, describe, expect, it } from "vitest";
import { actions, callEligibility, getDB, session } from "./store";
import { buildDemo } from "./seed";
import { validateUrl } from "./url";
import { kpis } from "./metrics";
import { visibleCampaigns } from "./rbac";

const demo = () => { const d = buildDemo(); session.loadDemo(d.db, d.adminId); return d; };

describe("platform rules", () => {
  beforeEach(() => { session.reset(); });

  it("creates a workspace with an admin and integration catalogue", () => {
    session.createWorkspace("Assorted Group", "Ada", "ada@example.com");
    expect(getDB().members[0].role).toBe("super_admin");
    expect(getDB().integrations.length).toBeGreaterThan(5);
    actions.saveVertical({ name: "Realty" });
    expect(getDB().verticals).toHaveLength(1);
  });

  it("requires exactly one valid campaign owner", () => {
    demo();
    expect(() => actions.saveCampaign({ name: "X", ownerType: "vertical" })).toThrow(/vertical/);
    expect(() => actions.saveCampaign({ name: "X", ownerType: "client", clientId: "nope" })).toThrow(/client/);
    const v = getDB().verticals[0].id;
    actions.saveCampaign({ name: "Both", ownerType: "vertical", verticalId: v, clientId: getDB().clients[0].id });
    const c = getDB().campaigns.find((x) => x.name === "Both")!;
    expect(c.clientId).toBeUndefined();
  });

  it("denies writes the role is not permitted to perform", () => {
    const d = demo();
    session.signInAs(d.agentId);
    expect(() => actions.saveClient({ name: "Nope" })).toThrow(/not permitted/);
    expect(() => actions.invite("A", "a@b.co", "sales_agent")).toThrow(/not permitted/);
  });

  it("limits client portal users to their own client's campaigns", () => {
    const d = demo();
    const portal = d.db.members.find((m) => m.role === "client_portal")!;
    const seen = visibleCampaigns(getDB(), portal);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((c) => c.clientId === portal.clientId)).toBe(true);
  });

  it("detects duplicate leads and reuses contacts", () => {
    demo();
    const camp = getDB().campaigns[0].id;
    const other = getDB().campaigns[1].id;
    actions.addLead({ campaignId: camp, name: "Zed", email: "zed@x.co", consentCalls: true });
    expect(() => actions.addLead({ campaignId: camp, name: "Zed 2", email: "ZED@x.co", consentCalls: true })).toThrow(/Duplicate/);
    const before = getDB().contacts.length;
    actions.addLead({ campaignId: other, name: "Zed", email: "zed@x.co", consentCalls: true });
    expect(getDB().contacts.length).toBe(before);
  });

  it("blocks calls without consent, on DNC, or outside the window, and records idempotently", () => {
    demo();
    const camp = getDB().campaigns.find((c) => c.status === "active")!;
    actions.saveCampaign({ ...camp, callWindowStart: "00:00", callWindowEnd: "23:59" });
    actions.addLead({ campaignId: camp.id, name: "NoConsent", phone: "+14155550101", consentCalls: false });
    actions.addLead({ campaignId: camp.id, name: "Consent", phone: "+14155550102", consentCalls: true });
    const noC = getDB().leads.find((l) => getDB().contacts.find((c) => c.id === l.contactId)?.name === "NoConsent")!;
    const yes = getDB().leads.find((l) => getDB().contacts.find((c) => c.id === l.contactId)?.name === "Consent")!;
    expect(callEligibility(getDB(), noC.id, new Date()).ok).toBe(false);
    expect(callEligibility(getDB(), yes.id, new Date()).ok).toBe(true);
    actions.saveCampaign({ ...camp, callWindowStart: "03:00", callWindowEnd: "03:01" });
    expect(callEligibility(getDB(), yes.id, new Date("2026-01-01T12:00:00")).ok).toBe(false);
    actions.saveCampaign({ ...camp, callWindowStart: "00:00", callWindowEnd: "23:59" });

    const n = getDB().calls.length;
    const input = { leadId: yes.id, durationSec: 60, connected: true, disposition: "Do Not Contact" as const, provider: "simulated", providerEventId: "evt-1", simulated: true };
    actions.recordCall(input); actions.recordCall(input);
    expect(getDB().calls.length).toBe(n + 1);
    expect(getDB().leads.find((l) => l.id === yes.id)!.status).toBe("Do Not Contact");
    expect(callEligibility(getDB(), yes.id, new Date()).ok).toBe(false);
  });

  it("does not double count duplicate provider events in KPIs", () => {
    demo();
    const c = getDB().calls[0];
    expect(kpis([c, { ...c }], []).attempts).toBe(1);
  });

  it("never reports a successful integration test without credentials", () => {
    demo();
    const i = getDB().integrations[0];
    actions.testIntegration(i.id);
    expect(getDB().integrations.find((x) => x.id === i.id)!.status).toBe("error");
  });

  it("rejects unsafe URLs", () => {
    for (const u of ["http://localhost:3000", "http://127.0.0.1", "http://10.0.0.5/x", "http://169.254.169.254/", "ftp://a.com", "https://user:pw@a.com", "http://intranet", "javascript:alert(1)"]) expect(validateUrl(u).ok).toBe(false);
    expect(validateUrl("https://example.com/path").ok).toBe(true);
  });
});
