import { describe, expect, it } from 'vitest';
import { createDatabase } from './db.js';

// Pins the fix for character_ai_memory bleeding a prior conversation's freeform AI answer into a
// brand-new, unrelated conversation for the same character. The route only injects
// previousAssistantMemory when the caller is continuing the exact conversation the memory row was
// written for (character_id AND source_conversation_id must both match), mirroring the query in
// routes/geminiRoutes.ts.
function readScopedMemory(db: ReturnType<typeof createDatabase>, characterId: number, conversationId: number | undefined) {
  if (!conversationId) return undefined;
  return db
    .prepare('SELECT summary,updated_at AS updatedAt FROM character_ai_memory WHERE character_id=? AND source_conversation_id=?')
    .get(characterId, conversationId) as { summary: string } | undefined;
}

describe('character_ai_memory conversation scoping', () => {
  it('does not surface a prior conversation\'s memory for a brand-new, different conversation', () => {
    const db = createDatabase(':memory:');
    const characterId = Number(
      db.prepare("INSERT INTO characters(name,league) VALUES ('Test','Standard')").run().lastInsertRowid,
    );
    const oldConversationId = Number(
      db.prepare("INSERT INTO gemini_conversations(mode,character_id,title) VALUES ('build',?,'old topic')").run(characterId).lastInsertRowid,
    );
    const newConversationId = Number(
      db.prepare("INSERT INTO gemini_conversations(mode,character_id,title) VALUES ('build',?,'new topic')").run(characterId).lastInsertRowid,
    );
    db.prepare(
      'INSERT INTO character_ai_memory(character_id,summary,source_conversation_id) VALUES (?,?,?)',
    ).run(characterId, 'Answer about the old, unrelated topic.', oldConversationId);

    expect(readScopedMemory(db, characterId, oldConversationId)?.summary).toBe('Answer about the old, unrelated topic.');
    expect(readScopedMemory(db, characterId, newConversationId)).toBeUndefined();
    expect(readScopedMemory(db, characterId, undefined)).toBeUndefined();
    db.close();
  });
});
