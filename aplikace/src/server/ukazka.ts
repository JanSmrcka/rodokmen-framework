// Fiktivní rodina pro vývoj a testy (žádná skutečná data). Použití: npm run db:seed
//
//   Václav Novák (1850–1910) × Anna Dvořáková (1855–1920)          ← praprarodiče (Kekulé 8, 9 od Petra)
//        │
//   Josef Novák (1880–1950) × Marie Svobodová (1885–1960)         Karel Novák (1883) – bratr Josefa
//        │                                                              │
//   Jan Novák (1915–1990) × Ludmila Malá (1920–2000)              Jiří Novák (1912) – bratranec Jana
//        │                       └─ Eva Novákova (1948, žije) – sestra Tomáše
//   Tomáš Novák (1945, žije) × Hana Černá (1950, žije)
//        │
//   Petr Novák (1980, žije) × Lucie Bílá (1982, žije) – rodiče Lucie: Martin Bílý (1955, žije)
import type { z } from "zod";
import { SYSTEM, type Actor } from "./actor";
import { addTip, addLog, addTask } from "./fronta";
import { upsertPlace, upsertHouse } from "./mista";
import { addRelation, createPerson, addEvent, addResidence } from "./osoby";
import { upsertRecord, upsertVolume } from "./prameny";
import type { Tx } from "./tx";
import type * as V from "./vstupy";
import { upsertLine, upsertStory, setSetting } from "./vyklad";

type P = { id: string; given: string; surname: string; sex: "M" | "F"; born?: string; died?: string; place?: string; living?: boolean; certainty?: z.infer<typeof V.Certainty> };

const PEOPLE: P[] = [
  { id: "vaclav-novak-1850", given: "Václav", surname: "Novák", sex: "M", born: "12. 3. 1850", died: "1910", place: "lhota", certainty: "doc" },
  { id: "anna-dvorakova-1855", given: "Anna", surname: "Dvořáková", sex: "F", born: "asi 1855", died: "1920", place: "lhota", certainty: "prob" },
  { id: "josef-novak-1880", given: "Josef", surname: "Novák", sex: "M", born: "4. 5. 1880", died: "1950", place: "lhota", certainty: "doc" },
  { id: "marie-svobodova-1885", given: "Marie", surname: "Svobodová", sex: "F", born: "1885", died: "1960", place: "horni-ves", certainty: "doc" },
  { id: "karel-novak-1883", given: "Karel", surname: "Novák", sex: "M", born: "1883", died: "1940", place: "lhota", certainty: "doc" },
  { id: "jiri-novak-1912", given: "Jiří", surname: "Novák", sex: "M", born: "1912", died: "1980", place: "lhota", certainty: "fam" },
  { id: "jan-novak-1915", given: "Jan", surname: "Novák", sex: "M", born: "8. 8. 1915", died: "1990", place: "lhota", certainty: "doc" },
  { id: "ludmila-mala-1920", given: "Ludmila", surname: "Malá", sex: "F", born: "1920", died: "2000", place: "horni-ves", certainty: "fam" },
  { id: "tomas-novak-1945", given: "Tomáš", surname: "Novák", sex: "M", born: "1945", living: true, certainty: "fam" },
  { id: "eva-novakova-1948", given: "Eva", surname: "Nováková", sex: "F", born: "1948", living: true, certainty: "fam" },
  { id: "hana-cerna-1950", given: "Hana", surname: "Černá", sex: "F", born: "1950", living: true, certainty: "fam" },
  { id: "petr-novak-1980", given: "Petr", surname: "Novák", sex: "M", born: "1980", living: true, certainty: "fam" },
  { id: "lucie-bila-1982", given: "Lucie", surname: "Bílá", sex: "F", born: "1982", living: true, certainty: "fam" },
  { id: "martin-bily-1955", given: "Martin", surname: "Bílý", sex: "M", born: "1955", living: true, certainty: "fam" },
];

const PARENTS: [string, string, string][] = [
  ["vaclav-novak-1850", "anna-dvorakova-1855", "josef-novak-1880"],
  ["vaclav-novak-1850", "anna-dvorakova-1855", "karel-novak-1883"],
  ["josef-novak-1880", "marie-svobodova-1885", "jan-novak-1915"],
  ["jan-novak-1915", "ludmila-mala-1920", "tomas-novak-1945"],
  ["jan-novak-1915", "ludmila-mala-1920", "eva-novakova-1948"],
  ["tomas-novak-1945", "hana-cerna-1950", "petr-novak-1980"],
];
const SINGLE_PARENT: [string, string][] = [
  ["karel-novak-1883", "jiri-novak-1912"],
  ["martin-bily-1955", "lucie-bila-1982"],
];
const COUPLES: [string, string][] = [
  ["vaclav-novak-1850", "anna-dvorakova-1855"],
  ["josef-novak-1880", "marie-svobodova-1885"],
  ["jan-novak-1915", "ludmila-mala-1920"],
  ["tomas-novak-1945", "hana-cerna-1950"],
  ["petr-novak-1980", "lucie-bila-1982"],
];

export async function seedUkazka(tx: Tx, actor: Actor = SYSTEM) {
  await setSetting(tx, actor, "nazev", "Rodokmen Novákových (ukázka)");
  await setSetting(tx, actor, "kontakt", { jmeno: "Petr", email: "petr@example.com" });
  await setSetting(tx, actor, "vychozi_koren", "petr-novak-1980");

  await upsertPlace(tx, actor, "lhota", { name: "Lhota", kind: "obec", lat: 49.5, lon: 15.2, hypothesis: false, names: [{ name: "Lhotta", lang: "de" }] });
  await upsertPlace(tx, actor, "horni-ves", { name: "Horní Ves", kind: "obec", lat: 49.42, lon: 15.31, hypothesis: false, names: [{ name: "Oberdorf", lang: "de" }] });

  await upsertVolume(tx, actor, "ukazka_1", {
    archive: "Státní oblastní archiv (ukázka)",
    portal: "ukázkový portál",
    title: "N Lhota 1840–1890",
    description: "fiktivní matrika narozených",
    url: "https://example.com/matrika/1",
  });
  await upsertRecord(tx, actor, "n-lhota-1880-josef-novak", {
    volumeKey: "ukazka_1",
    imageNo: 42,
    kind: "N",
    dateText: "4. 5. 1880",
    title: "Narození Josefa Nováka",
    summary: "Josef, syn Václava Nováka, domkáře v Lhotě čp. 12, a Anny roz. Dvořákové.",
    transcriptOrig: "[Datum] 4. Mai 1880 [Dítě] Josef [Otec] Wenzel Nowak, Häusler in Lhotta No 12",
    transcriptCs: "4. května 1880, Josef, otec Václav Novák, domkář v Lhotě čp. 12",
    review: "overeno",
  });

  for (const p of PEOPLE) {
    await createPerson(tx, actor, {
      id: p.id,
      sex: p.sex,
      given: p.given,
      surname: p.surname,
      certainty: p.certainty ?? "unk",
      living: p.living ?? null,
      yearsText: p.living ? `* ${p.born}` : `${p.born ?? "?"}–${p.died ?? "?"}`,
      placeholder: false,
      names: [],
      sources: [],
      events: [
        ...(p.born ? [{ type: "narozeni" as const, dateText: p.born, placeSlug: p.place ?? null, certainty: p.certainty ?? "unk", role: "hlavni", sources: [] }] : []),
        ...(p.died ? [{ type: "umrti" as const, dateText: p.died, placeSlug: p.place ?? null, certainty: p.certainty ?? "unk", role: "hlavni", sources: [] }] : []),
      ],
    });
  }
  for (const [f, m, c] of PARENTS) {
    await addRelation(tx, actor, { type: "rodic", aId: f, bId: c, certainty: "doc", sources: [] });
    await addRelation(tx, actor, { type: "rodic", aId: m, bId: c, certainty: "doc", sources: [] });
  }
  for (const [p, c] of SINGLE_PARENT) await addRelation(tx, actor, { type: "rodic", aId: p, bId: c, certainty: "fam", sources: [] });
  for (const [a, b] of COUPLES) await addRelation(tx, actor, { type: "manzele", aId: a, bId: b, certainty: "doc", sources: [] });

  // narození Josefa doložené zápisem
  await addEvent(tx, actor, {
    type: "krest",
    dateText: "5. 5. 1880",
    placeSlug: "lhota",
    certainty: "doc",
    persons: [
      { personId: "josef-novak-1880", role: "hlavni" },
      { personId: "vaclav-novak-1850", role: "otec" },
      { personId: "anna-dvorakova-1855", role: "matka" },
    ],
    sources: [{ recordKey: "n-lhota-1880-josef-novak" }],
  });

  await upsertHouse(tx, actor, null, {
    placeSlug: "lhota",
    cp: "12",
    name: "U Nováků",
    kind: "domek",
    certainty: "doc",
    holders: [{ name: "Václav Novák", personId: "vaclav-novak-1850", fromText: "1875", how: "koupí", certainty: "doc", recordKey: null }],
  });
  await addResidence(tx, actor, { personId: "vaclav-novak-1850", placeSlug: "lhota", houseKey: "lhota-12", cp: "12", fromText: "1875", toText: "1910", role: "domkář", certainty: "doc", sources: [{ recordKey: "n-lhota-1880-josef-novak" }] });

  await upsertLine(tx, actor, "novakove", { name: "Novákové", description: "Domkáři ze Lhoty čp. 12.", color: "#EFB45F", founderId: "vaclav-novak-1850" });
  await upsertLine(tx, actor, "svobodovi", { name: "Svobodovi", description: "Z Horní Vsi.", color: "#7FB7BE", founderId: "marie-svobodova-1885" });
  await upsertStory(tx, actor, "pribeh", { kind: "pribeh", title: "Příběh rodu", lead: "Ukázkový příběh.", bodyMd: "## Začátky\n\n[Václav Novák](/osoba/vaclav-novak-1850/) koupil domek ve Lhotě v roce 1875.", sort: 0 });

  const t = await addTip(tx, actor, {
    kind: "zvest",
    text: "Babička vyprávěla, že Václav přišel do Lhoty z Horní Vsi a byl tam mlynářským tovaryšem.",
    personIds: ["vaclav-novak-1850"],
    toldByPersonId: "tomas-novak-1945",
    channel: "z paměti",
    sensitive: false,
  });
  await addLog(tx, actor, {
    title: "N Lhota 1840–1890: hledán křest Josefa",
    textMd: "Nalezen na snímku 42.",
    volumeKey: "ukazka_1",
    pages: "snímky 30–45",
    result: "nalezeno",
    personIds: ["josef-novak-1880"],
    recordKeys: ["n-lhota-1880-josef-novak"],
    tipIds: [],
  });
  await addLog(tx, actor, {
    title: "N Horní Ves 1840–1860: Václav Novák nenalezen",
    textMd: "Prošly roky 1845–1855, Václav Novák tu narozen není.",
    pages: "snímky 1–80",
    result: "nenalezeno",
    personIds: ["vaclav-novak-1850"],
    recordKeys: [],
    tipIds: [t.id],
  });
  await addTask(tx, actor, { title: "Ověřit zvěst o Václavovi z Horní Vsi", body: "Projít O Horní Ves 1870–1880.", kind: "badani", status: "otevreny", priority: 1, personIds: ["vaclav-novak-1850"] });
}
