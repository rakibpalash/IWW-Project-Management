import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { text, context } = await req.json()

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `You are helping write a concise, professional description for a project management ${context ?? 'workspace'}.

Enhance the following description to be clearer, more professional, and more informative. Keep it under 3 sentences. Return ONLY the enhanced description text, no explanations or preamble.

Original: ${text}`,
      },
    ],
  })

  const enhanced = (message.content[0] as { type: string; text: string }).text?.trim()
  return NextResponse.json({ enhanced })
}
