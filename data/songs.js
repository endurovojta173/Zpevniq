/**
 * Zpěvník — databáze písní.
 *
 * JAK PŘIDAT PÍSEŇ
 *   1. Zkopíruj šablonu na konci souboru.
 *   2. Vyplň slug (malá písmena, bez diakritiky, pomlčky místo mezer),
 *      title, author, tags a text.
 *   3. Do `text` piš písničku tak, jak se zpívá. Prázdný řádek = nová sloka.
 *   4. Ulož soubor a obnov stránku v prohlížeči.
 *
 * Pořadí písní v tomto poli = pořadí, v jakém se zobrazí ve zpěvníku.
 */

const SONGS = [
  {
    slug: 'na-pankraci',
    title: 'Na Pankráci',
    author: 'lidová',
    tags: ['hody'],
    text: `
Na Pankráci na malém vršíčku, stojí pěkné stromořadí,
měl jsem holku namluvenou, ale jinej mě za ní chodí.

Vy mládenci, kteří jste jako já, nemilujte doopravdy,
pomilujte, pošpásujte, ale lásku jim neslibujte.

Zdálo se mě ze čtvrtka na pátek, že jsem se svou Andulkou spal,
probudím se, obrátím se, ale jak mě ten sen oklamal.
`,
  },
  {
    slug: 'co-jste-hasici',
    title: 'Co jste hasiči',
    author: 'lidová',
    tags: ['hody'],
    text: `
Co jste hasiči, co jste dělali,
že jste nám ten pivo, pivo, pivovárek shořet nechali,
že jste nám ten pivo, pivo, pivovárek shořet nechali.

Shořet nechali aj tu hospodu,
my starý mazáci, starý ulejváci, máme pít vodu,
my starý mazáci, starý ulejváci, máme pít vodu.

Vodu nepijem, my pijeme rum,
vodu pijou žáby, pivo starý báby, my pijeme rum,
vodu pijou žáby, pivo starý báby, my pijeme rum.
`,
  },
  {
    slug: 'vysoky-jalovec',
    title: 'Vysoký jalovec',
    author: 'lidová',
    tags: ['hody'],
    text: `
Vysoký jalovec, vysoký jako já,
přeskoč ho, má milá, rovnýma nohama.
Já ho nepřeskočím, já sa ráda točím,
na tebe, šohajku, zapomenut musím.

Uvázali kozu u trna,
ona sa jim v noci utrhla.
`,
  },
  {
    slug: 'breclavska-kasarna',
    title: 'Břeclavská kasárna',
    author: 'lidová',
    tags: ['hody'],
    text: `
Břeclavská kasárňa malovaná, malujů ju chlapci se šavlama,
chlapci se šavlama, děvčata slzama, břeclavská kasárňa malovaná.

Břeclavská kasárňa malovaná, malujů ju chlapci se šavlama,
chlapci se šavlama, děvčata slzama, břeclavská kasárňa malovaná.

Břeclavská kasárňa široký dvůr, po něm sa procházá šohajek můj,
po něm sa procházá, převelice pláče, až sa ta kasárňa celá třase.

Břeclavská kasárňa široký dvůr, po něm sa procházá šohajek můj,
po něm sa procházá, převelice pláče, až sa ta kasárňa celá třase.

Počkajte, děvčata, tři měsíce, bude nás rukovat na tisíce,
vy budete plakat, my budeme skákat v břeclavské hospodě při muzice.

Počkajte, děvčata, tři měsíce, bude nás rukovat na tisíce,
vy budete plakat, my budeme skákat v břeclavské hospodě při muzice.
`,
  },
  {
    slug: 'nedaleko-od-trencina',
    title: 'Nedaleko od Trenčína',
    author: 'lidová',
    tags: ['hody'],
    text: `
Nedaleko od Trenčína,
bývá mladá Kateřina,

Nedaleko od Trenčína,
bývá mladá Kateřina.

Černé oči má, to musí být má milá,
takú frajárečku já chcem, co má jméno Kateřina.

My jsme chlapci od dědiny,
milujeme Kateřiny,

My jsme chlapci od dědiny,
milujeme Kateřiny.

Černé oči má, to musí být má milá,
takú frajárečku já chcem, co má jméno Kateřina.

Takú frajárku sem dostal,
jako by ju sám čert poslal,

Takú frajárku sem dostal,
jako by ju sám čert poslal.

Černé oči má, to musí být má milá,
takú frajárečku já chcem, co má jméno Kateřina.
`,
  },
  {
    slug: 'kdyby-byla-morava',
    title: 'Kdyby byla Morava',
    author: 'lidová',
    tags: ['hody'],
    text: `
Kdyby byla Morava jako je Slezko,
dala bych ti huběnku, až by to plesklo,
ale že je Morava malučká,
ošidila dcérečka synečka,
ale že je Morava malučká,
ošidila dcérečka synečka.

Kdyby byla Morava jako je Vídeň,
dala bych ti huběnek na celý týden,
ale že je Morava malučká,
ošidila dcérečka synečka,
ale že je Morava malučká,
ošidila dcérečka synečka.

Kdyby byla Morava jako jsou Čechy,
dala bych ti huběnek za čtyry měchy,
ale že je Morava malučká,
ošidila dcérečka synečka,
ale že je Morava malučká,
ošidila dcérečka synečka.

Kdyby byla Morava jako jsou Uhry,
dala bych ti huběnek na čtyry fůry,
ale že je Morava malučká,
ošidila dcérečka synečka,
ale že je Morava malučká,
ošidila dcérečka synečka.
`,
  },
  {
    slug: 'vinecko-bile',
    title: 'Vínečko bílé',
    author: 'lidová',
    tags: ['hody'],
    text: `
Vínečko bílé, si od mé milé,
budu ťa pít, co budu žít, vínečko bílé,
budu ťa pít, co budu žít, vínečko bílé.

Vínečko rudé, si od té druhé,
budu ťa pít, co budu žít, vínečko rudé,
budu ťa pít, co budu žít, vínečko rudé.

Vínečka obě, frajárky moje,
budu vás pít, co budu žít, vínečka obě,
budu vás pít, co budu žít, vínečka obě.
`,
  },
  {
    slug: 'studentska-halenka',
    title: 'Studentská halenka',
    author: 'lidová',
    tags: ['hody'],
    text: `
Studentská halenka, ta je tuze tenká,
podňů se vyspala, poctivost ztratila, nejedna panenka,
Studentská halenka, ta je tuze tenká,
podňů se vyspala, poctivost ztratila, nejedna panenka.

Nejedna panenka, nejeden mládenec,
který tu panenku, poctivou frajárku, připravil o věnec,
Nejedna panenka, nejeden mládenec,
který tu panenku, poctivou frajárku, připravil o věnec.

Nežel holka, nežel, že jsem s tebou ležel,
já ležel na seně vožralej jak štěně, já o tom nevěděl,
Nežel holka, nežel, že jsem s tebou ležel,
já ležel na seně vožralej jak štěně, já o tom nevěděl.

Dalas přes mě nožku, už sme byli v rožku,
dalas přes mě obě, už sme byli v sobě, chvála panu bohu,
Dalas přes mě nožku, už sme byli v rožku,
dalas přes mě obě, už sme byli v sobě, chvála panu bohu.

Kdyby se poctivost na poli rodila,
nejedna panenka, poctivá frajárka, by pro ňu chodila,
Kdyby se poctivost na poli rodila,
nejedna panenka, poctivá frajárka, by pro ňu chodila.

Ale že poctivost se v poli nerodí,
nejedna panenka, poctivá frajárka, předčasně porodí,
Ale že poctivost se v poli nerodí,
nejedna panenka, poctivá frajárka, předčasně porodí.
`,
  },
];

/*
 * ŠABLONA NOVÉ PÍSNĚ — zkopíruj do pole výše (za poslední píseň, před ] ):
 *
 *  {
 *    slug: 'jmena-pisne',
 *    title: 'Jméno písně',
 *    author: 'lidová',
 *    tags: ['hody'],
 *    text: `
 * První řádek první sloky,
 * druhý řádek první sloky.
 *
 * První řádek druhé sloky,
 * druhý řádek druhé sloky.
 * `,
 *  },
 */

// Umožní načíst data i v Node (testy), v prohlížeči je SONGS globální proměnná.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SONGS;
}
