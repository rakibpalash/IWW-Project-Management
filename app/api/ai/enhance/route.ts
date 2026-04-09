import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  try {
    const { text, context } = await req.json()

    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured — GEMINI_API_KEY missing' }, { status: 503 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `You are helping write a concise, professional description for a project management ${context ?? 'workspace'}.

Enhance the following description to be clearer, more professional, and more informative. Keep it under 3 sentences. Return ONLY the enhanced description text, no explanations or preamble.

Original: ${text}`

    const result = await model.generateContent(prompt)
    const enhanced = result.response.text().trim()

    return NextResponse.json({ enhanced })
  } catch (err: any) {
    console.error('[ai/enhance] error:', err?.message ?? err)
    return NextResponse.json(
      { error: err?.message ?? 'AI service error' },
      { status: 500 }
    )
  }
}
