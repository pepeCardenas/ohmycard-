// URLs de imágenes de cartas oficiales. Hay dos orígenes:
// - TCGdex: se guarda la URL base y se le agrega /low.webp o /high.webp.
// - pokemontcg.io (respaldo cuando TCGdex no tiene imagen): se guarda la URL .png chica;
//   la grande termina en _hires.png.

const PTCG = 'https://images.pokemontcg.io/'

export const isCardImage = (url: string) => url.startsWith('https://assets.tcgdex.net/') || url.startsWith(PTCG)

export function cardImageUrl(image: string, quality: 'low' | 'high') {
  if (image.startsWith(PTCG)) return quality === 'high' ? image.replace(/\.png$/, '_hires.png') : image
  return `${image}/${quality}.webp`
}
