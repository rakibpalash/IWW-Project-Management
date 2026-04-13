import { redirect } from 'next/navigation'

export default async function WorkspaceDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/spaces/${id}`)
}
