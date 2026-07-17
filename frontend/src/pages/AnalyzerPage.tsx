import {
  ArrowUpRight,
  ChevronDown,
  Database,
  LoaderCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserRoundSearch,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { AssistantPanels } from "../components/AssistantPanels";
import { ResultPanel } from "../components/ResultPanel";
import { useI18n } from "../i18n";
import type {
  Analysis,
  BuildFitProfile,
  CharacterSummary,
  CharacterTotals,
  ItemInput,
  NormalizedItem,
} from "../types";

const sample = `Item Class: Boots
Rarity: Rare
Rune Pace
Stone Greaves
--------
Armour: 268
--------
Requirements:
Level: 65
--------
Item Level: 78
--------
+76 to maximum Life
+31% to Fire Resistance
+27% to Cold Resistance
25% increased Movement Speed`;
const initial: ItemInput = {
  itemType: "",
  baseType: "",
  rarity: "",
  customMods: [],
};
const fields: Array<[keyof ItemInput, string, string]> = [
  ["itemType", "Item type", "text"],
  ["baseType", "Base type", "text"],
  ["itemLevel", "Item level", "number"],
  ["requiredLevel", "Required level", "number"],
  ["energyShield", "Energy shield", "number"],
  ["evasion", "Evasion", "number"],
  ["armour", "Armour", "number"],
  ["deflection", "Deflection", "number"],
  ["runicWard", "Runic Ward", "number"],
  ["life", "Maximum life", "number"],
  ["mana", "Maximum mana", "number"],
  ["intelligence", "Intelligence", "number"],
  ["strength", "Strength", "number"],
  ["dexterity", "Dexterity", "number"],
  ["fireResistance", "Fire resistance %", "number"],
  ["coldResistance", "Cold resistance %", "number"],
  ["lightningResistance", "Lightning resistance %", "number"],
  ["chaosResistance", "Chaos resistance %", "number"],
  ["movementSpeed", "Movement speed %", "number"],
  ["rarityFind", "Rarity find %", "number"],
  ["spirit", "Spirit", "number"],
];

export function AnalyzerPage() {
  const { locale } = useI18n();
  const br = locale === "pt-BR";
  const text = (english: string, portuguese: string) =>
    br ? portuguese : english;
  const [itemText, setItemText] = useState("");
  const [item, setItem] = useState<ItemInput>(initial);
  const [league, setLeague] = useState("Runes of Aldur");
  const [rate, setRate] = useState(65);
  const [manual, setManual] = useState("");
  const [equippedItemText, setEquippedItemText] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [totals, setTotals] = useState<CharacterTotals>({});
  const [profiles, setProfiles] = useState<BuildFitProfile[]>([]);
  const [profileId, setProfileId] = useState("generic-build-fit");
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [characterId, setCharacterId] = useState<number | "">("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mode, setMode] = useState<"Beginner" | "Advanced">("Beginner");
  const [result, setResult] = useState<Analysis | null>(null);
  const [normalized, setNormalized] = useState<NormalizedItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .settings()
      .then((s) => {
        setLeague(s.defaultLeague);
        setRate(s.divineToExalted);
        setMode(s.interfaceMode || "Beginner");
        setAdvancedOpen((s.interfaceMode || "Beginner") === "Advanced");
      })
      .catch(() => {});
    api
      .buildProfiles()
      .then((x) => setProfiles(x.profiles || []))
      .catch(() => {});
    api
      .characters()
      .then((x) => setCharacters(x.characters || []))
      .catch(() => {});
  }, []);
  function chooseCharacter(value: string) {
    const id = value ? Number(value) : "";
    setCharacterId(id);
    const character = characters.find((x) => x.id === id);
    if (character) {
      setLeague(character.league);
      if (character.buildProfileId) setProfileId(character.buildProfileId);
    }
  }
  function update(key: keyof ItemInput, value: string) {
    setItem((old) => ({
      ...old,
      [key]:
        fields.find((x) => x[0] === key)?.[2] === "number"
          ? value === ""
            ? undefined
            : Number(value)
          : value,
    }));
  }
  function updateTotal(key: keyof CharacterTotals, value: string) {
    setTotals((old) => ({
      ...old,
      [key]: value === "" ? undefined : Number(value),
    }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const source = itemText.trim() || sample;
      const [analysis, parsed] = await Promise.all([
        api.analyze({
          league,
          itemText: source,
          equippedItemText: compareOpen ? equippedItemText : "",
          characterTotals: compareOpen ? totals : undefined,
          selectedBuildProfileId: profileId,
          item,
          manualListings: manual,
          divineToExalted: rate,
          characterId: characterId || undefined,
        }),
        api.normalizeItem({ text: source, league }),
      ]);
      setItemText(source);
      setResult(analysis);
      setNormalized(parsed.item);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : text("Analysis failed", "A análise falhou"),
      );
    } finally {
      setLoading(false);
    }
  }
  async function openTrade() {
    try {
      const { url } = await api.buildUrl({ league, itemText, item });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : text("Could not open Trade2", "Não foi possível abrir o Trade2"),
      );
    }
  }
  return (
    <div className="page analyzer-page">
      <section className="companion-hero">
        <div>
          <span className="eyebrow">EXILE COMPANION</span>
          <h1>
            {text("Your next upgrade,", "Seu próximo upgrade,")}
            <br />
            <em>{text("made obvious.", "sem complicação.")}</em>
          </h1>
          <p>
            {text(
              "Paste an item. Choose a build. Get a clear, evidence-backed next move.",
              "Cole um item, escolha uma build e receba um próximo passo claro e baseado em evidências.",
            )}
          </p>
        </div>
        <div className="hero-steps">
          <span>
            <b>1</b> {text("Paste item", "Cole o item")}
          </span>
          <span>
            <b>2</b> {text("Pick build", "Escolha a build")}
          </span>
          <span>
            <b>3</b> {text("Make a move", "Decida")}
          </span>
        </div>
      </section>
      <form className="analyzer-layout" onSubmit={submit}>
        <div className="input-column">
          <section className="card form-card primary-input-card">
            <div className="section-title">
              <span>01</span>
              <div>
                <h2>{text("What did you find?", "O que você encontrou?")}</h2>
                <p>
                  {text(
                    "Copy an item in-game and paste it here. Stats are read automatically.",
                    "Copie um item no jogo e cole aqui. Os atributos são lidos automaticamente.",
                  )}
                </p>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => setItemText(sample)}
              >
                <Upload size={14} />
                {text("Try example", "Usar exemplo")}
              </button>
            </div>
            <textarea
              className="item-paste"
              aria-label={text("Item text", "Texto do item")}
              value={itemText}
              onChange={(e) => setItemText(e.target.value)}
              placeholder={
                "Paste item text here…\n\nCtrl+C while hovering an item in Path of Exile 2"
              }
            />
          </section>
          <section className="card form-card build-selector-card">
            <div className="section-title">
              <span>02</span>
              <div>
                <h2>{text("Who is this for?", "Para quem é este item?")}</h2>
                <p>
                  {text(
                    "A saved character reuses their build and gear. A profile makes stat scoring specific.",
                    "Um personagem salvo reutiliza sua build e equipamentos. O perfil torna a pontuação específica.",
                  )}
                </p>
              </div>
              <UserRoundSearch />
            </div>
            {characters.length > 0 && (
              <label>
                {text("Character", "Personagem")}
                <select
                  aria-label={text("Character", "Personagem")}
                  value={characterId}
                  onChange={(e) => chooseCharacter(e.target.value)}
                >
                  <option value="">
                    {text("No saved character", "Nenhum personagem salvo")}
                  </option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.league}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              {text("Build profile", "Perfil da build")}
              <select
                aria-label={text("Build profile", "Perfil da build")}
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
              >
                {profiles.length ? (
                  profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.source === "custom" ? " · Custom" : ""}
                    </option>
                  ))
                ) : (
                  <option value="generic-build-fit">Generic Build Fit</option>
                )}
              </select>
            </label>
            <div className="setup-links">
              <a href="/characters">
                {text("Add character", "Adicionar personagem")}{" "}
                <ArrowUpRight size={13} />
              </a>
              <a href="/build">
                {text("Create build", "Criar build")} <ArrowUpRight size={13} />
              </a>
            </div>
          </section>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <div className="action-row">
            <button className="primary-button" disabled={loading}>
              {loading ? <LoaderCircle className="spin" /> : <Search />}
              {loading
                ? text("Analyzing your item…", "Analisando seu item…")
                : text("Analyze item", "Analisar item")}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={openTrade}
            >
              {text("Open Trade2", "Abrir Trade2")} <ArrowUpRight size={16} />
            </button>
          </div>
          <button
            type="button"
            className="expand-button advanced-options-toggle"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen(!advancedOpen)}
          >
            <SlidersHorizontal size={16} />
            {text("Advanced options", "Opções avançadas")}
            <ChevronDown className={advancedOpen ? "rotated" : ""} />
          </button>
          {advancedOpen && (
            <div className="advanced-options">
              <section className="card form-card">
                <div className="section-title">
                  <h2>
                    {text("Override item details", "Corrigir detalhes do item")}
                  </h2>
                  <p>
                    {text(
                      "Use only if the copied item text misses a value.",
                      "Use somente quando o texto copiado não contiver algum valor.",
                    )}
                  </p>
                </div>
                <div className="manual-fields">
                  <label>
                    {text("Rarity", "Raridade")}
                    <select
                      value={item.rarity}
                      onChange={(e) => update("rarity", e.target.value)}
                    >
                      <option value="">
                        {text("Use pasted rarity", "Usar raridade colada")}
                      </option>
                      <option>rare</option>
                      <option>unique</option>
                      <option>magic</option>
                      <option>normal</option>
                    </select>
                  </label>
                  {fields.map(([key, label, type]) => (
                    <label key={key}>
                      {label}
                      <input
                        type={type}
                        value={(item[key] as string | number | undefined) ?? ""}
                        onChange={(e) => update(key, e.target.value)}
                      />
                    </label>
                  ))}
                  <label className="wide">
                    {text("Custom mods", "Modifiers personalizados")}
                    <textarea
                      value={item.customMods.join("\n")}
                      onChange={(e) =>
                        setItem({
                          ...item,
                          customMods: e.target.value
                            .split("\n")
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                </div>
              </section>
              <section className="card form-card compare-card">
                <div className="section-title">
                  <ShieldCheck />
                  <div>
                    <h2>
                      {text("Compare equipped item", "Comparar item equipado")}
                    </h2>
                    <p>
                      {text(
                        "See whether this changes caps, attributes and build fit.",
                        "Veja se a troca altera limites, atributos e compatibilidade com a build.",
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="expand-button"
                  onClick={() => setCompareOpen(!compareOpen)}
                >
                  {compareOpen
                    ? text("Hide comparison", "Ocultar comparação")
                    : text(
                        "Compare an equipped item",
                        "Comparar um item equipado",
                      )}
                  <ChevronDown className={compareOpen ? "rotated" : ""} />
                </button>
                {compareOpen && (
                  <div className="equipped-comparison-inputs">
                    <label>
                      {text(
                        "Current equipped item",
                        "Item equipado atualmente",
                      )}
                      <textarea
                        aria-label={text(
                          "Current Equipped Item",
                          "Item equipado atualmente",
                        )}
                        className="item-paste equipped-paste"
                        value={equippedItemText}
                        onChange={(e) => setEquippedItemText(e.target.value)}
                      />
                    </label>
                    <div className="character-total-fields">
                      {(
                        [
                          ["fireResistance", "Current Fire Resistance"],
                          ["coldResistance", "Current Cold Resistance"],
                          [
                            "lightningResistance",
                            "Current Lightning Resistance",
                          ],
                          ["chaosResistance", "Current Chaos Resistance"],
                          ["strength", "Current Strength"],
                          ["dexterity", "Current Dexterity"],
                          ["intelligence", "Current Intelligence"],
                          ["spirit", "Current Spirit"],
                        ] as Array<[keyof CharacterTotals, string]>
                      ).map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <input
                            aria-label={label}
                            type="number"
                            value={totals[key] ?? ""}
                            onChange={(e) => updateTotal(key, e.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </section>
              <section className="card form-card">
                <div className="section-title">
                  <Database />
                  <div>
                    <h2>
                      {text("Market settings", "Configurações de mercado")}
                    </h2>
                    <p>
                      {text(
                        "Manual listings are only used when live evidence is unavailable.",
                        "Listings manuais só são usados quando não há evidência ao vivo.",
                      )}
                    </p>
                  </div>
                </div>
                <div className="market-grid">
                  <label>
                    {text("League", "Liga")}
                    <select
                      aria-label={text("League", "Liga")}
                      value={league}
                      onChange={(e) => setLeague(e.target.value)}
                    >
                      <option>Runes of Aldur</option>
                      <option>Standard</option>
                      <option>Hardcore</option>
                    </select>
                  </label>
                  <label>
                    1 Divine equals
                    <input
                      aria-label="Divine to Exalted rate"
                      type="number"
                      value={rate}
                      onChange={(e) => setRate(Number(e.target.value))}
                    />
                  </label>
                </div>
                <textarea
                  aria-label={text("Manual listings", "Listings manuais")}
                  className="manual-paste"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="Optional: paste exported listings here"
                />
              </section>
            </div>
          )}
        </div>
        <aside className="side-column">
          <section className="card trust-card">
            <div className="crest">EC</div>
            <span className="eyebrow">
              {text("CLEAR, NOT CLEVER", "CLARO, SEM INVENÇÕES")}
            </span>
            <h3>
              {text(
                "Every recommendation explains itself.",
                "Toda recomendação explica seus motivos.",
              )}
            </h3>
            <p>
              See the confidence, evidence and trade-offs behind each move —
              without made-up prices.
            </p>
            <ul>
              <li>Build-aware scoring</li>
              <li>Comparable market evidence</li>
              <li>Safe crafting guidance</li>
            </ul>
          </section>
          <section className="card quick-links">
            <h3>
              {text("Not sure where to start?", "Não sabe por onde começar?")}
            </h3>
            <a href="/characters">
              Set up your character <ArrowUpRight size={14} />
            </a>
            <a href="/build-doctor">
              Check your weakest slot <ArrowUpRight size={14} />
            </a>
            <a href="/leveling">
              Find leveling upgrades <ArrowUpRight size={14} />
            </a>
          </section>
        </aside>
      </form>
      {result && <ResultPanel result={result} mode={mode} />}{" "}
      {normalized && (
        <AssistantPanels
          item={normalized}
          itemText={itemText}
          mode={mode}
          league={league}
          characterId={characterId || undefined}
        />
      )}
    </div>
  );
}
