// Draws the pizza picture (SVG). If a real photo exists in public/pizzas/, that photo is shown instead.
import { useState } from 'react';
import { MOCK } from './lib.jsx';
const SAUCE = {
  'Tomato Basil': '#C8321E',
  Pesto: '#7BA23F',
  BBQ: '#6B2D1A',
  Alfredo: '#F3E5BC',
  'Spicy Arrabbiata': '#A31D0C',
};
const CHEESE = {
  Mozzarella: '#FBEFC9',
  Cheddar: '#F4A93A',
  Parmesan: '#F7E3A1',
  'Vegan Cashew': '#EBD9B4',
};
const VEG = {
  Onion: '#C79BD4',
  Capsicum: '#3F8F44',
  Tomato: '#E4472A',
  Mushroom: '#CDB898',
  Olives: '#2A2A2A',
  'Sweet Corn': '#F5C518',
  Jalapeño: '#86B83A',
  Paneer: '#FFF6DA',
};
const rnd = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
const wob = (r, s) =>
  Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * 6.2832,
      q = r + (rnd(s + i) - 0.5) * 3.5;
    return (100 + Math.cos(a) * q).toFixed(1) + ',' + (100 + Math.sin(a) * q).toFixed(1);
  }).join(' ');
const at = (seed, rmin, rmax) => {
  const a = rnd(seed) * 6.2832,
    r = rmin + rnd(seed + 7) * (rmax - rmin);
  return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r];
};

function inner(sauce, cheese, veggies) {
  let o = `<polygon points="${wob(97, 1)}" fill="#BF7A2B"/><polygon points="${wob(92, 50)}" fill="#E4AA55"/>`;
  for (let i = 0; i < 16; i++) {
    const [x, y] = at(300 + i, 85, 93);
    o += `<ellipse cx="${x}" cy="${y}" rx="${3 + rnd(i) * 4}" ry="${2 + rnd(i + 5) * 2.5}" fill="#6B3410" opacity=".45" transform="rotate(${rnd(i + 9) * 180} ${x} ${y})"/>`;
  }
  o += `<polygon points="${wob(84, 100)}" fill="${SAUCE[sauce] || '#C8321E'}"/><polygon points="${wob(78, 150)}" fill="${CHEESE[cheese] || '#FBEFC9'}" opacity=".97"/>`;
  for (let i = 0; i < 10; i++) {
    const [x, y] = at(400 + i, 8, 64);
    o += `<circle cx="${x}" cy="${y}" r="${4 + rnd(i + 3) * 6}" fill="#D9902D" opacity=".32"/>`;
  }
  for (let i = 0; i < 5; i++) {
    const [x, y] = at(450 + i, 6, 60);
    o += `<ellipse cx="${x}" cy="${y}" rx="${9 + rnd(i) * 8}" ry="2.2" fill="#fff" opacity=".35" transform="rotate(${rnd(i + 4) * 180} ${x} ${y})"/>`;
  }
  veggies.forEach((v, vi) => {
    for (let k = 0; k < 7; k++) {
      const [x, y] = at(vi * 37 + k * 5 + 1, 12, 66);
      const rot = rnd(k + vi) * 360;
      o += `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="4.5" fill="${VEG[v] || '#888'}" stroke="rgba(0,0,0,.3)" stroke-width=".7" transform="rotate(${rot} ${x} ${y})"/><ellipse cx="${x - 1.5}" cy="${y - 1.2}" rx="2.4" ry="1.2" fill="#fff" opacity=".3" transform="rotate(${rot} ${x} ${y})"/>`;
    }
  });
  for (let i = 0; i < 4; i++) {
    const [x, y] = at(500 + i, 14, 58);
    o += `<ellipse cx="${x}" cy="${y}" rx="8" ry="4" fill="#2F7A3A" stroke="#1F5A28" stroke-width=".8" transform="rotate(${rnd(i + 2) * 180} ${x} ${y})"/>`;
  }
  return (
    o +
    `<ellipse cx="72" cy="62" rx="58" ry="34" fill="#fff" opacity=".08" transform="rotate(-32 100 100)"/><circle cx="100" cy="100" r="97" fill="none" stroke="#000" stroke-opacity=".14" stroke-width="3"/>`
  );
}
export default function Pizza({ sauce, cheese, veggies = [], className = '' }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Pizza"
      dangerouslySetInnerHTML={{ __html: inner(sauce, cheese, veggies) }}
    />
  );
}
// Real photo from /public/pizzas/<name>.jpg when present, otherwise the illustrated pizza
export function PizzaPic({ name, recipe = {}, className }) {
  const [bad, setBad] = useState(false);
  if (bad || MOCK)
    return (
      <Pizza
        className={className}
        sauce={recipe.sauce}
        cheese={recipe.cheese}
        veggies={recipe.veggies}
      />
    );
  return (
    <img
      className={className}
      src={`/pizzas/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`}
      alt={name}
      loading="lazy"
      onError={() => setBad(true)}
    />
  );
}
