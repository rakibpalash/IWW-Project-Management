import { redirect } from 'next/navigation'

export default async function ListDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/lists/${id}`)
}
