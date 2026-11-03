'use client'

import { useEffect, useState } from 'react'
import { type CardDetail, type Pricing, type TcgplayerVariant, fetchCardDetail, imageUrl } from './api'
import type { CardRef } from './store'
import SlotActions from './SlotActions'

interface Props {
  card: CardRef
  /** Dónde está en el binder, ej. "Página 1 · casillero 3". */
  where?: string
  onMove?: () => void
  onChange?: () => void
  onRemove: () => void
  removeNote?: string
  removeLabel?: string
  onClose: () => void
}

const money = (value: number | undefined, currency: string) =>
  value == null || Number.isNaN(value)
    ? null
    : new Intl.NumberFormat('es', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)

const date = (iso?: string) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normal',
  holofoil: 'Holo',
  holo: 'Holo',
  reverse: 'Reverse holo',
  reverseHolofoil: 'Reverse holo',
  '1stEdition': '1ª edición',
  '1stEditionHolofoil': '1ª edición holo',
  unlimited: 'Unlimited',
  unlimitedHolofoil: 'Unlimited holo',
}

const num = (v: unknown) => (typeof v === 'number' ? v : undefined)

/** Precio estimado: tendencia de Cardmarket y precio de mercado de TCGplayer. */
function estimate(pricing?: Pricing | null) {
  const cm = pricing?.cardmarket
  const cmValue = num(cm?.trend) ?? num(cm?.avg) ?? num(cm?.['trend-holo']) ?? num(cm?.['avg-holo'])
  const tp = pricing?.tcgplayer
  let tpValue: number | undefined
  if (tp) {
    for (const [k, v] of Object.entries(tp)) {
      if (k === 'updated' || k === 'unit' || !v || typeof v !== 'object') continue
      const market = (v as TcgplayerVariant).marketPrice ?? (v as TcgplayerVariant).midPrice
      if (market != null && (tpValue == null || market < tpValue)) tpValue = market
    }
  }
  return {
    eur: money(cmValue, String(cm?.unit ?? 'EUR')),
    usd: money(tpValue, String(tp?.unit ?? 'USD')),
  }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === false) return null
  return (
    <div className="row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Prices({ pricing }: { pricing?: Pricing | null }) {
  const cm = pricing?.cardmarket
  const tp = pricing?.tcgplayer
  if (!cm && !tp) {
    return <p className="muted">Todavía no hay precios de mercado para esta carta.</p>
  }
  const eur = String(cm?.unit ?? 'EUR')
  const usd = String(tp?.unit ?? 'USD')
  const tpVariants = tp
    ? Object.entries(tp).filter(
        (e): e is [string, TcgplayerVariant] => e[0] !== 'updated' && e[0] !== 'unit' && !!e[1] && typeof e[1] === 'object',
      )
    : []
  const hasHolo = cm && (num(cm['trend-holo']) != null || num(cm['avg-holo']) != null)

  return (
    <>
      {cm && (
        <div className="market">
          <h3>
            Cardmarket <small>{date(cm.updated)}</small>
          </h3>
          <Row label="Tendencia" value={money(num(cm.trend), eur)} />
          <Row label="Promedio" value={money(num(cm.avg), eur)} />
          <Row label="Promedio 30 días" value={money(num(cm.avg30), eur)} />
          <Row label="Desde" value={money(num(cm.low), eur)} />
          {hasHolo && (
            <>
              <Row label="Tendencia holo" value={money(num(cm['trend-holo']), eur)} />
              <Row label="Promedio 30 días holo" value={money(num(cm['avg30-holo']), eur)} />
            </>
          )}
        </div>
      )}
      {tp && tpVariants.length > 0 && (
        <div className="market">
          <h3>
            TCGplayer <small>{date(tp.updated as string | undefined)}</small>
          </h3>
          {tpVariants.map(([k, v]) => (
            <Row
              key={k}
              label={VARIANT_LABELS[k] ?? k}
              value={
                <>
                  {money(v.marketPrice ?? v.midPrice, usd) ?? '—'}
                  {v.lowPrice != null && v.highPrice != null && (
                    <small className="range">
                      {' '}
                      ({money(v.lowPrice, usd)} – {money(v.highPrice, usd)})
                    </small>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}
    </>
  )
}

export default function CardDetailView({
  card,
  where,
  onMove,
  onChange,
  onRemove,
  onClose,
  removeNote,
  removeLabel,
}: Props) {
  const [detail, setDetail] = useState<CardDetail | null>(null)
  const [error, setError] = useState(false)
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    let alive = true
    fetchCardDetail(card.id, card.lang)
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [card.id, card.lang])

  const name = detail?.name ?? card.name
  const image = detail?.image ?? card.image
  const est = estimate(detail?.pricing)
  const number = detail?.localId ?? card.localId
  const setLine = [
    detail?.set?.name ?? card.setName,
    number && `#${number}${detail?.set?.cardCount?.official ? `/${detail.set.cardCount.official}` : ''}`,
  ]
    .filter(Boolean)
    .join(' · ')

  // Lo más importante de un vistazo
  const chips = [
    detail?.hp != null && `PS ${detail.hp}`,
    ...(detail?.types ?? []),
    detail?.stage,
    detail?.category && detail.category !== 'Pokémon' && detail.category,
    detail?.rarity ?? card.rarity,
  ].filter((c): c is string => !!c)

  const attacks = detail?.attacks?.filter((a) => a.name) ?? []

  return (
    <div className="sheet-screen detail" role="dialog" aria-label={`Detalle de ${name}`}>
      <header className="list-top">
        <div className="list-title">
          <h1>{name}</h1>
          {where && <p>{where}</p>}
        </div>
        <button className="done" onClick={onClose}>
          Cerrar
        </button>
      </header>

      <div className="detail-body">
        <div className="detail-hero">
          {image ? (
            <button className="detail-img-btn" onClick={() => setZoom(true)} aria-label="Ver la carta en grande">
              <img className="detail-img" src={imageUrl(image, 'high')} alt={name} />
            </button>
          ) : (
            <div className="noimg big">{name}</div>
          )}
          {setLine && <p className="detail-set">{setLine}</p>}
          {chips.length > 0 && (
            <ul className="chips" aria-label="Datos principales">
              {chips.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>

        <section className="panel price-panel">
          <h2>Precio estimado</h2>
          {!detail && !error && <p className="muted">Buscando precios…</p>}
          {error && <p className="muted">No se pudieron cargar los datos. Revisa tu conexión.</p>}
          {detail && (est.eur || est.usd) && (
            <div className="estimate">
              {est.eur && (
                <div>
                  <strong>{est.eur}</strong>
                  <span>Cardmarket</span>
                </div>
              )}
              {est.usd && (
                <div>
                  <strong>{est.usd}</strong>
                  <span>TCGplayer</span>
                </div>
              )}
            </div>
          )}
          {detail &&
            (est.eur || est.usd ? (
              <details className="market-more">
                <summary>Ver precios por mercado</summary>
                <Prices pricing={detail.pricing} />
              </details>
            ) : (
              <Prices pricing={detail.pricing} />
            ))}
        </section>

        {attacks.length > 0 && (
          <section className="panel">
            <h2>{attacks.length === 1 ? 'Ataque' : 'Ataques'}</h2>
            <div className="attacks">
              {attacks.map((a, i) => (
                <div className="attack" key={i}>
                  <div className="attack-head">
                    <strong>{a.name}</strong>
                    {a.damage != null && a.damage !== '' && <span className="damage">{a.damage}</span>}
                  </div>
                  {a.cost && a.cost.length > 0 && <small className="muted">{a.cost.join(' · ')}</small>}
                  {a.effect && <p>{a.effect}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {detail && (
          <section className="panel">
            <h2>Más datos</h2>
            <Row label="Evoluciona de" value={detail.evolveFrom} />
            <Row
              label="Debilidad"
              value={detail.weaknesses?.map((w) => `${w.type} ${w.value ?? ''}`.trim()).join(', ')}
            />
            <Row label="Retirada" value={detail.retreat} />
            <Row label="Regulación" value={detail.regulationMark} />
            <Row label="Ilustrador" value={detail.illustrator} />
            {detail.description && <p className="flavor">{detail.description}</p>}
          </section>
        )}
      </div>

      <SlotActions
        name={name}
        onMove={onMove}
        onChange={onChange}
        onRemove={onRemove}
        removeNote={removeNote}
        removeLabel={removeLabel}
      />

      {zoom && image && (
        <div className="viewer" onClick={() => setZoom(false)} role="dialog" aria-label={`${name} en grande`}>
          <img src={imageUrl(image, 'high')} alt={name} />
          <p className="viewer-hint">Toca para cerrar</p>
        </div>
      )}
    </div>
  )
}
