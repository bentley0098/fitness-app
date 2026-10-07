// Where tapping a session on the week page goes: the matched Garmin activity
// when there is one, otherwise the planned view of the same page.
export function sessionHref(session: { id: string; completion: { activityIds?: string[] } }): string {
  const activityId = session.completion.activityIds?.[0];
  return activityId ? `/activity/${activityId}` : `/activity/${session.id}?planned=1`;
}
