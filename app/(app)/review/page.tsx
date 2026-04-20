import { ReviewSession } from '@/components/review-session'
import { getDueCards } from '@/app/actions/cards'

export const dynamic = 'force-dynamic'

export default async function ReviewPage() {
  const initialCards = await getDueCards(10)
  return <ReviewSession initialCards={initialCards} />
}
