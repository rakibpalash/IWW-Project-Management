import { redirect } from 'next/navigation'

export default async function TaskRedirect({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>
}) {
  const { id, taskId } = await params
  redirect(`/lists/${id}/tasks/${taskId}`)
}
