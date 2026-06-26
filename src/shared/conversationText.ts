const MAX_SPOKEN_LENGTH = 260
const MAX_SENTENCES = 2

const TECHNICAL_DETAIL_FALLBACK = 'I found the technical details. Please check the Hermes chat log for the exact files and commands.'

export function toAvatarConversationText(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return ''

  const withoutCodeBlocks = normalized.replace(/```[\s\S]*?```/g, '\n')
  const lines = withoutCodeBlocks
    .split('\n')
    .map((line) => cleanLine(line))
    .filter(Boolean)

  const conversationalLines = lines.filter((line) => !isTechnicalLine(line))
  const hadTechnicalDetails = conversationalLines.length !== lines.length || withoutCodeBlocks.length !== normalized.length
  const source = conversationalLines.length > 0 ? conversationalLines.join(' ') : ''
  const summary = summarize(source)

  if (!summary) return hadTechnicalDetails ? TECHNICAL_DETAIL_FALLBACK : ''
  if (!hadTechnicalDetails) return summary

  return appendLogHint(summary)
}

function cleanLine(line: string): string {
  return line
    .replace(/`[^`]+`/g, '')
    .replace(/\[[^\]]+\]\([^)]+\)/g, '')
    .replace(/^#+\s*/, '')
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function summarize(text: string): string {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim()

  if (!cleaned) return ''

  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned]
  const summary = sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, MAX_SENTENCES)
    .join(' ')

  if (summary.length <= MAX_SPOKEN_LENGTH) return summary

  const clipped = summary.slice(0, MAX_SPOKEN_LENGTH)
  const lastSpace = clipped.lastIndexOf(' ')
  return `${clipped.slice(0, lastSpace > 120 ? lastSpace : MAX_SPOKEN_LENGTH).trim()}...`
}

function appendLogHint(summary: string): string {
  const hint = 'The technical details are in the Hermes chat log.'
  if (summary.includes('Hermes chat log')) return summary

  const withHint = `${summary} ${hint}`
  return withHint.length <= MAX_SPOKEN_LENGTH ? withHint : hint
}

function isTechnicalLine(line: string): boolean {
  return (
    looksLikePath(line) ||
    looksLikeCommand(line) ||
    looksLikeCode(line) ||
    looksLikeStackTrace(line) ||
    hasDenseTechnicalTokens(line)
  )
}

function looksLikePath(line: string): boolean {
  return (
    /(?:[A-Za-z]:\\|~\/|\.{1,2}\/|\/[\w.-]+\/)[^\s]*/.test(line) ||
    /\b[\w.-]+\.(?:ts|tsx|js|jsx|vue|json|md|css|html|py|rs|go|java|cs|cpp|c|h|yml|yaml|toml|lock)\b/i.test(line)
  )
}

function looksLikeCommand(line: string): boolean {
  return /^(?:\$|>|PS>|rtk|npm|pnpm|yarn|node|python|py|git|cargo|npx|hermes|cd|mkdir|copy|del|rm)\b/i.test(line)
}

function looksLikeCode(line: string): boolean {
  return (
    /^(?:import|export|const|let|var|function|class|interface|type|return|if|else|for|while|switch|case|try|catch)\b/.test(line) ||
    /[{}()[\];=<>]/.test(line) && /\b(?:const|function|return|async|await|string|number|boolean|Promise|Record)\b/.test(line)
  )
}

function looksLikeStackTrace(line: string): boolean {
  return /^\s*at\s+\S+|\b(?:Error|Exception|Traceback|ENOENT|EACCES|TypeError|ReferenceError|SyntaxError):/.test(line)
}

function hasDenseTechnicalTokens(line: string): boolean {
  const tokens = line.split(/\s+/)
  if (tokens.length < 4) return false

  const technicalTokens = tokens.filter((token) => {
    return /[_{}[\]<>\\/=]|--\w+|\w+\(\)|\w+:\w+|https?:\/\//.test(token)
  })

  return technicalTokens.length / tokens.length > 0.35
}
