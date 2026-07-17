import { Archive, Bot, History, LoaderCircle, Plus, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import type { GeminiChatResponse } from '../types';

type Message = { role: 'user' | 'assistant'; text: string; meta?: GeminiChatResponse['result'] };

export function GeminiCoach({
  mode,
  context,
  onAction,
  characterId,
}: {
  mode: 'build' | 'sale';
  context: Record<string, unknown>;
  onAction?: (action: { action: string; slot?: string }) => void;
  characterId?: number;
}) {
  const { locale, t, format } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(''),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [conversations, setConversations] = useState<Array<{ id: number; title: string; updatedAt: string }>>([]),
    [historyOpen, setHistoryOpen] = useState(false),
    [archivePending, setArchivePending] = useState(false);
  useEffect(() => {
    if (!characterId) return;
    api
      .geminiConversations(characterId)
      .then((response) => setConversations(response.conversations || []))
      .catch(() => setConversations([]));
  }, [characterId, conversationId]);
  async function openConversation(id: number) {
    setError('');
    try {
      const response = await api.geminiConversation(id);
      setConversationId(id);
      setMessages(
        response.messages.map((row) => ({
          role: row.role,
          text: row.text,
          meta: row.metadataJson ? JSON.parse(row.metadataJson) : undefined,
        })),
      );
      setHistoryOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('gemini.askError'));
    }
  }
  function newConversation() {
    setConversationId(undefined);
    setMessages([]);
    setArchivePending(false);
  }
  async function archiveConversation() {
    if (!conversationId) return;
    try {
      await api.updateGeminiConversation(conversationId, { archived: true });
      newConversation();
      setConversations((old) => old.filter((row) => row.id !== conversationId));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('gemini.askError'));
    }
  }
  const prompts =
    mode === 'build'
      ? [
          'Compare buying, crafting and passive reallocation.',
          'Which quest or passive gap has the highest impact?',
          'What should I upgrade first within my budget?',
        ]
      : [
          'Compare selling now with repricing later.',
          'Why might this item sell slowly?',
          'Which listings should I review first?',
        ];
  async function ask(text = input) {
    const question = text.trim();
    if (!question || loading) return;
    const history = messages.map(({ role, text }) => ({ role, text }));
    setMessages((old) => [...old, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const response = await api.geminiChat({
        mode,
        message: question,
        context,
        language: locale,
        history,
        conversationId,
        characterId,
      });
      if (response.conversationId) setConversationId(response.conversationId);
      if (!response.available || !response.result) {
        setError(response.reason === 'gemini_not_configured' ? t('gemini.notConfigured') : t('gemini.unavailable'));
        return;
      }
      setMessages((old) => [...old, { role: 'assistant', text: response.result!.answer, meta: response.result }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('gemini.askError'));
    } finally {
      setLoading(false);
    }
  }
  const askLabel = mode === 'build' ? t('gemini.buildAsk') : t('gemini.saleAsk');
  return (
    <section className="card gemini-coach" data-testid={`gemini-${mode}-coach`}>
      <div className="gemini-coach-head">
        <Bot />
        <div>
          <span className="eyebrow">{t('gemini.eyebrow').toUpperCase()}</span>
          <h2>{mode === 'build' ? t('gemini.buildTitle') : t('gemini.saleTitle')}</h2>
          <p>{t('gemini.help')}</p>
        </div>
        {characterId && (
          <div className="gemini-conversation-tools">
            <button type="button" onClick={() => setHistoryOpen(!historyOpen)}>
              <History />
              {t('gemini.history')}
            </button>
            <button type="button" onClick={newConversation}>
              <Plus />
              {t('gemini.new')}
            </button>
            {conversationId && (
              <button type="button" onClick={() => setArchivePending(true)}>
                <Archive />
                {t('gemini.archive')}
              </button>
            )}
          </div>
        )}
      </div>
      {historyOpen && (
        <div className="gemini-history">
          {conversations.length ? (
            conversations.map((row) => (
              <button type="button" key={row.id} onClick={() => void openConversation(row.id)}>
                <strong>{row.title}</strong>
                <span>{format.dateTime(row.updatedAt)}</span>
              </button>
            ))
          ) : (
            <p>{t('gemini.noHistory')}</p>
          )}
        </div>
      )}
      {archivePending && (
        <div className="gemini-archive-confirm" role="alertdialog" aria-label={t('gemini.archiveLabel')}>
          <span>{t('gemini.archiveQuestion')}</span>
          <button type="button" onClick={() => setArchivePending(false)}>
            {t('gemini.cancel')}
          </button>
          <button type="button" onClick={() => void archiveConversation()}>
            {t('gemini.confirmArchive')}
          </button>
        </div>
      )}
      <div className="gemini-prompts">
        {prompts.map((prompt) => (
          <button type="button" key={prompt} onClick={() => void ask(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
      {messages.length > 0 && (
        <div className="gemini-messages">
          {messages.map((message, index) => (
            <article key={index} className={message.role}>
              <small>{message.role === 'user' ? t('gemini.you').toUpperCase() : 'GEMINI'}</small>
              <p>{message.text}</p>
              {message.meta && (
                <>
                  <div className={`gemini-confidence ${message.meta.confidence.toLowerCase()}`}>
                    <ShieldCheck /> {message.meta.confidence} {t('gemini.confidence')}
                  </div>
                  {message.meta.factsUsed.length > 0 && (
                    <details>
                      <summary>{t('gemini.evidence')}</summary>
                      {message.meta.factsUsed.map((fact) => (
                        <span key={fact}>· {fact}</span>
                      ))}
                    </details>
                  )}
                  {message.meta.suggestedActions.length > 0 && (
                    <div className="gemini-actions">
                      {message.meta.suggestedActions
                        .filter((action) => action.action !== 'none')
                        .map((action) => (
                          <button
                            type="button"
                            key={action.label}
                            title={action.reason}
                            onClick={() => onAction?.(action)}
                          >
                            <Sparkles />
                            {action.label}
                          </button>
                        ))}
                    </div>
                  )}
                  {message.meta.warnings.map((warning) => (
                    <span className="gemini-warning" key={warning}>
                      {warning}
                    </span>
                  ))}
                </>
              )}
            </article>
          ))}
        </div>
      )}
      {error && (
        <div className="category-warnings">
          <span>{error}</span>
        </div>
      )}
      <div className="gemini-input">
        <textarea
          aria-label={askLabel}
          rows={2}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={mode === 'build' ? t('gemini.buildPlaceholder') : t('gemini.salePlaceholder')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void ask();
            }
          }}
        />
        <button type="button" aria-label={askLabel} onClick={() => void ask()} disabled={loading || !input.trim()}>
          {loading ? <LoaderCircle className="spin" /> : <Send />}
        </button>
      </div>
    </section>
  );
}
