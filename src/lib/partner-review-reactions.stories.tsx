import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { aggregatePartnerReviewReactionStates } from "./partner-review-reactions";

function PartnerReviewReactionsPreview() {
  const states = aggregatePartnerReviewReactionStates(
    ["review-1", "review-2", "review-3"],
    [
      { review_id: "review-1", member_id: "member-1", reaction: "recommend" },
      { review_id: "review-1", member_id: "member-2", reaction: "disrecommend" },
      { review_id: "review-2", member_id: "member-2", reaction: "recommend" },
      { review_id: "ignored", member_id: "member-9", reaction: "recommend" },
    ],
    "member-2",
  );
  const noCurrentUser = aggregatePartnerReviewReactionStates(
    ["review-1"],
    [{ review_id: "review-1", member_id: "member-2", reaction: "recommend" }],
    null,
  );

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>review-1:{JSON.stringify(states.get("review-1"))}</div>
      <div>review-2:{JSON.stringify(states.get("review-2"))}</div>
      <div>review-3:{JSON.stringify(states.get("review-3"))}</div>
      <div>ignored:{String(states.get("ignored"))}</div>
      <div>no-user:{JSON.stringify(noCurrentUser.get("review-1"))}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/PartnerReviewReactions",
  component: PartnerReviewReactionsPreview,
} satisfies Meta<typeof PartnerReviewReactionsPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(
        'review-1:{"recommendCount":1,"disrecommendCount":1,"myReaction":"disrecommend"}',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'review-2:{"recommendCount":1,"disrecommendCount":0,"myReaction":"recommend"}',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('review-3:{"recommendCount":0,"disrecommendCount":0,"myReaction":null}'),
    ).toBeInTheDocument();
    await expect(canvas.getByText("ignored:undefined")).toBeInTheDocument();
    await expect(
      canvas.getByText('no-user:{"recommendCount":1,"disrecommendCount":0,"myReaction":null}'),
    ).toBeInTheDocument();
  },
};
