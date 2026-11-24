// Not in `actions.ts`: a "use server" file can only export async functions.

export type PublishDraftState = { error?: string };

export const initialPublishDraftState: PublishDraftState = {};
