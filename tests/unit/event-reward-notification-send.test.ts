import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const state = vi.hoisted(() => ({
  draw: {} as Record<string, unknown>, winners: [] as Record<string, unknown>[],
  records: [] as Record<string, unknown>[], calls: 0, campaignCalls: 0,
  failAssociation: false, failSummary: false, failLedger: false, failWinners: false,
  inProgress: false, loseFence: false, skipDelivery: false, sdkClient: null as unknown,
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: () => state.sdkClient ?? ({
  from(table: string) {
    let payload: Record<string, unknown> | null = null;
    const filters: Array<[string, unknown]> = [];
    const inFilters: Array<[string, unknown[]]> = [];
    const neqFilters: Array<[string, unknown]> = [];
    const query = {
      select: () => query, order: () => query, range: () => query,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      neq: (key: string, value: unknown) => { neqFilters.push([key,value]); return query; },
      in: (key: string, value: unknown[]) => { inFilters.push([key,value]); return query; },
      maybeSingle: () => query,
      update: (value: Record<string, unknown>) => { payload=value; return query; },
      then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
        let data: unknown = null; let error: unknown = null;
        if (table === "event_reward_draws") {
          if (!payload) data=structuredClone(state.draw);
          else if ((payload.status && state.failSummary) || (!payload.status && state.failAssociation)) {
            state.failSummary=false; state.failAssociation=false; error={message:"injected draw write failure"};
          } else if (state.loseFence && payload.status) { data=null; }
          else {
            const matches = filters.every(([key,value]) => key.startsWith("metadata->>")
              ? (state.draw.metadata as Record<string,unknown>)[key.slice(11)]===value
              : state.draw[key]===value);
            if (matches) { Object.assign(state.draw,payload); data={id:state.draw.id}; }
          }
        } else if (table === "event_reward_winners") {
          state.winners=state.winners.map(row=>({draw_id:"draw-1",...row}));
          const matched=state.winners.filter(row=>filters.every(([key,value])=>row[key]===value)
            && inFilters.every(([key,value])=>value.includes(row[key]))
            && neqFilters.every(([key,value])=>row[key]!==value));
          if(payload && state.failWinners){state.failWinners=false;error={message:"winner write failure"};}
          else {
            if(payload) matched.forEach(row=>Object.assign(row,payload));
            data=matched.map(row=>({...row}));
          }
        }
        else if (table === "notification_deliveries") {
          data=state.records; if(state.failLedger) error={message:"ledger unavailable"};
        } else throw new Error(`unexpected table ${table}`);
        return Promise.resolve({data,error}).then(resolve,reject);
      },
    }; return query;
  },
}) }));
vi.mock("@/lib/admin-notification-ops", () => ({
  sendAdminNotificationCampaign: vi.fn(async (_input, _source, contract) => {
    state.campaignCalls++;
    if (state.inProgress) return { notificationId:"stable-notice", campaignDisposition:"in_progress", channelResults:{}, warnings:[] };
    // Reuses one durable campaign identity across retries, like claim RPC.
    if (!contract) { state.calls++; throw new Error("campaign claim contract missing"); }
    const targets=await contract.beforeDelivery({notificationId:"stable-notice",attemptToken:`attempt-${state.campaignCalls}`,disposition:"resumed"});
    for(const id of targets) {
      if(state.skipDelivery) continue;
      state.calls++;
      state.records.push({notification_id:"stable-notice",member_id:id,channel:"mm",status:"sent",provider_status:"sent"});
    }
    await contract.resolveDeliveryStatus("stable-notice");
    return {notificationId:"stable-notice",campaignDisposition:"resumed",channelResults:{},warnings:[]};
  }),
}));
import { sendEventRewardWinnerNotifications } from "@/lib/promotions/event-rewards";
const send=()=>sendEventRewardWinnerNotifications("draw-1",{eventSlug:"signup-reward",confirmationText:"알림 발송"});
beforeEach(()=>{
  state.draw={id:"draw-1",event_slug:"signup-reward",status:"finalized",sent_at:null,sent_notification_id:null,guide_path:"/events/signup-reward/winner-form",metadata:{},updated_at:"2026-05-01T00:00:00Z"};
  state.sdkClient=null;state.winners=[{draw_id:"draw-1",member_id:"a",notification_status:"pending"}];
  state.records=[];state.calls=0;state.campaignCalls=0;state.failAssociation=false;state.failSummary=false;state.failLedger=false;state.failWinners=false;state.inProgress=false;state.loseFence=false;state.skipDelivery=false;
});
describe("durable winner delivery orchestration",()=>{
  it("persists campaign association before any external send",async()=>{
    state.failAssociation=true; await expect(send()).rejects.toThrow("draw write failure");expect(state.calls).toBe(0);
  });
  it("repairs a failed summary from the same notification without resending",async()=>{
    state.failSummary=true;await expect(send()).rejects.toThrow("draw write failure");expect(state.calls).toBe(1);
    expect(state.draw.sent_notification_id).toBe("stable-notice");await expect(send()).resolves.toMatchObject({status:"sent",notificationId:"stable-notice"});expect(state.calls).toBe(1);
  });
  it("winner bookkeeping failure remains repairable without replaying external delivery",async()=>{
    state.failWinners=true;await expect(send()).rejects.toThrow("winner write failure");
    expect(state.draw.sent_at).toBeNull();expect(state.calls).toBe(1);
    await expect(send()).resolves.toMatchObject({status:"sent"});expect(state.calls).toBe(1);
  });
  it("in-progress campaign does not become an all-zero success",async()=>{
    state.inProgress=true;await expect(send()).rejects.toThrow("이미 진행 중");expect(state.draw.sent_at).toBeNull();expect(state.calls).toBe(0);
  });
  it("an inbox receipt from a still-running campaign is not premature completion",async()=>{
    state.draw.sent_notification_id="stable-notice";
    state.draw.metadata={notificationCampaignId:"stable-notice",notificationCampaignAttemptToken:"running"};
    state.records=[{notification_id:"stable-notice",member_id:"a",channel:"in_app",status:"sent",provider_status:"sent"}];
    state.inProgress=true;
    await expect(send()).rejects.toThrow("이미 진행 중");expect(state.draw.sent_at).toBeNull();
  });
  it("lost draw attempt fence cannot commit an older result",async()=>{
    state.loseFence=true;await expect(send()).rejects.toThrow("다른 발송 작업");expect(state.draw.sent_at).toBeNull();
  });
  it("unreadable ledger stops before sending",async()=>{
    state.draw.sent_notification_id="old";state.failLedger=true;await expect(send()).rejects.toThrow("발송 이력을 확인");expect(state.calls).toBe(0);
  });
  it("legacy timeout and missing legacy evidence require reconciliation",async()=>{
    state.draw.sent_notification_id="old";state.records=[{notification_id:"old",member_id:"a",channel:"mm",status:"failed",provider_status:"timeout"}];
    await expect(send()).rejects.toThrow("결과 확인");state.records=[{notification_id:"old",member_id:"a",channel:"push",status:"failed",provider_status:"failed"}];
    await expect(send()).rejects.toThrow("결과 확인");
    state.records=[];await expect(send()).rejects.toThrow("결과 확인");expect(state.calls).toBe(0);
  });
  it("only definitively failed legacy winners enter the stable campaign",async()=>{
    state.draw.sent_notification_id="old";state.winners.push({member_id:"b",notification_status:"sent"});
    state.records=[{notification_id:"old",member_id:"a",channel:"mm",status:"failed",provider_status:"forbidden"},{notification_id:"old",member_id:"b",channel:"push",status:"sent",provider_status:"sent"}];
    await expect(send()).resolves.toMatchObject({status:"sent"});expect(state.calls).toBe(1);
  });
  it("partial recovery only sends definitive failures while uncertain winners stay pending",async()=>{
    state.draw.sent_notification_id="old";state.winners.push({member_id:"b",notification_status:"pending"});
    state.records=[{notification_id:"old",member_id:"a",channel:"mm",status:"failed",provider_status:"forbidden"},{notification_id:"old",member_id:"b",channel:"mm",status:"failed",provider_status:"timeout"}];
    await expect(send()).resolves.toMatchObject({status:"partial_failed"});expect(state.calls).toBe(1);expect(state.draw.sent_at).toBeNull();
  });
  it("zero receipts cannot mark an unnotified winner sent",async()=>{
    state.skipDelivery=true;await expect(send()).resolves.toMatchObject({status:"failed"});expect(state.draw.sent_at).toBeNull();
  });
});


describe("actual PostgREST SDK write receipts", () => {
  function useSdk(mode: string) {
    let failedOnce = false;
    state.sdkClient = createClient("https://fixture.invalid", "synthetic-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        const method = init?.method ?? "GET";
        if (method === "GET") {
          if (table === "event_reward_winners" && url.searchParams.get("notification_status") === "eq.sent"
            && mode === "already-sent-read404") return new Response("[]", {status:404});
          return new Response(JSON.stringify(table === "event_reward_draws" ? [state.draw]
            : table === "event_reward_winners" ? state.winners : state.records));
        }
        const body = JSON.parse(String(init?.body));
        if (table === "event_reward_draws") {
          if (!body.status && mode === "association-array404") return new Response("[]", { status: 404 });
          if (!body.status && mode === "association-wrong-id") return new Response(JSON.stringify({id:"other"}));
          if (body.status && mode === "terminal-array404") return new Response("[]", { status: 404 });
          Object.assign(state.draw, body);
          return new Response(JSON.stringify({id:state.draw.id}));
        }
        if (table === "event_reward_winners") {
          if (!failedOnce && (mode === "winner-empty404" || mode === "winner-array404")) {
            failedOnce = true;
            return new Response(mode === "winner-array404" ? "[]" : null, { status: 404 });
          }
          if (url.searchParams.get("notification_status") === "neq.sent"
            && state.winners[0].notification_status === "sent") return new Response("[]");
          Object.assign(state.winners[0], body);
          if (mode === "winner-wrong-draw") return new Response(JSON.stringify([{...state.winners[0],draw_id:"other"}]));
          if (mode === "winner-partial") return new Response(JSON.stringify([state.winners[0]]));
          return new Response(JSON.stringify(state.winners));
        }
        throw new Error("unexpected fixture request");
      } },
    });
  }
  for (const mode of ["association-array404", "association-wrong-id"]) {
    it(`${mode} cannot authorize an external send`, async () => {
      useSdk(mode);
      await expect(send()).rejects.toThrow();
      expect(state.calls).toBe(0);
      expect(state.draw.sent_notification_id).toBeNull();
    });
  }
  for (const mode of ["winner-empty404", "winner-array404"]) {
    it(`${mode} cannot finalize the draw and retries only bookkeeping`, async () => {
      useSdk(mode);
      await expect(send()).rejects.toThrow();
      expect(state.draw.sent_at).toBeNull();
      expect(state.winners[0].notification_status).toBe("pending");
      expect(state.calls).toBe(1);
      await expect(send()).resolves.toMatchObject({status:"sent"});
      expect(state.winners[0].notification_status).toBe("sent");
      expect(state.calls).toBe(1);
    });
  }
  it("a winner receipt from another draw cannot finalize the current draw", async () => {
    useSdk("winner-wrong-draw");
    await expect(send()).rejects.toThrow("발송 기록");expect(state.draw.sent_at).toBeNull();
  });
  it("partial winner receipts cannot finalize the draw", async () => {
    state.winners.push({draw_id:"draw-1",member_id:"b",notification_status:"pending"});
    useSdk("winner-partial");
    await expect(send()).rejects.toThrow("발송 기록");expect(state.draw.sent_at).toBeNull();
  });
  it("explicit readback preserves an already-sent winner excluded by the monotonic update", async () => {
    state.winners[0].notification_status="sent";state.skipDelivery=true;useSdk("already-sent");
    await expect(send()).resolves.toMatchObject({status:"failed"});
    expect(state.winners[0].notification_status).toBe("sent");
  });
  it("an empty normalized read response is not proof of an already-sent winner", async () => {
    state.winners[0].notification_status="sent";state.skipDelivery=true;useSdk("already-sent-read404");
    await expect(send()).rejects.toThrow("발송 기록");expect(state.draw.status).toBe("finalized");
  });
  it("terminal draw array receipt does not report completion", async () => {
    useSdk("terminal-array404");
    await expect(send()).rejects.toThrow();
    expect(state.draw.sent_at).toBeNull();
  });
});
