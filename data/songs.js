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
    text: '',
  },
  {
    slug: 'vysoky-jalovec',
    title: 'Vysoký jalovec',
    author: 'lidová',
    tags: ['hody'],
    text: '',
  },
  {
    slug: 'breclavska-kasarna',
    title: 'Břeclavská kasárna',
    author: 'lidová',
    tags: ['hody'],
    text: '',
  },
  {
    slug: 'nedaleko-od-trencina',
    title: 'Nedaleko od Trenčína',
    author: 'lidová',
    tags: ['hody'],
    text: '',
  },
  {
    slug: 'kdyby-byla-morava',
    title: 'Kdyby byla Morava',
    author: 'lidová',
    tags: ['hody'],
    text: '',
  },
  {
    slug: 'vinecko-bile',
    title: 'Vinečko bílé',
    author: 'lidová',
    tags: ['hody'],
    text: '',
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
