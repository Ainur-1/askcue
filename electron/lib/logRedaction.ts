const secretField = /api[_-]?key|(?:openai|gemini|groq|claude)key|token$|password|secret|authorization|cookie|private[_-]?key/i;

export function redactLogText(text: string): string {
    return text
        .replace(/\bsk-[A-Za-z0-9_-]{12,}/g, '[REDACTED]')
        .replace(/\bAIza[A-Za-z0-9_-]+/g, '[REDACTED]')
        .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/=_-]+/gi, '$1 [REDACTED]')
        .replace(/((?:api[_-]?key|(?:openai|gemini|groq|claude)key|access[_-]?token|password|secret|authorization)["']?\s*[:=]\s*)(["'])(.*?)\2/gi, '$1$2[REDACTED]$2')
        .replace(/((?:api[_-]?key|(?:openai|gemini|groq|claude)key|access[_-]?token|password|secret|authorization)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi, '$1[REDACTED]');
}

export function formatLogArguments(args: unknown[]): string {
    return args.map(value => {
        if (value instanceof Error) return redactLogText(value.stack || value.message);
        if (typeof value !== 'object' || value === null) return redactLogText(String(value));
        const seen = new WeakSet<object>();
        try {
            return redactLogText(JSON.stringify(value, (key, item) => {
                if (secretField.test(key) && typeof item === 'string') return '[REDACTED]';
                if (typeof item === 'object' && item !== null) {
                    if (seen.has(item)) return '[Circular]';
                    seen.add(item);
                }
                return item;
            }) || '[Undefined log value]');
        } catch { return '[Unserializable log value]'; }
    }).join(' ');
}
