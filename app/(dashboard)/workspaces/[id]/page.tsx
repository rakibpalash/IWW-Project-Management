import { redirect } from 'next/navigation'

export default async function SpaceDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/spaces/${id}`)
}
