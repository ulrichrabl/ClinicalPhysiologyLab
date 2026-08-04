import { el, clear, card, fmt } from '../../../core/ui/kit.js';
import { AnatomyGraph, FILTERS } from './graph.js';
import { guard } from '../../../core/diagnostics.js';
import { NODES, SITES, LEVEL_LABEL, MODALITY_LABEL } from '../data/anatomy.js';
import { findingsFor, findingsForNodes, sparedForNodes, groupFindings, SYNDROMES, cordLevelOf,
  TEMPOS, differentialFor, rungForNodes, RUNG_LABEL, tempoById } from '../model/localize.js';

/* ---------------------------------------------------------------------------
   Localise.

   Left: the anatomy graph. Right: what the examiner would find.

   The two are the same fact viewed twice — a place in the nervous system, and
   the bedside consequences of damaging it. Moving between them in both
   directions is the skill being trained, so the panel works either way: pick a
   lesion and read the findings, or pick a named syndrome and see where it sits.
--------------------------------------------------------------------------- */
export class LocalizeView {
  constructor({ patient, onLesion }) {
    this.patient = patient;
    this.onLesion = onLesion || (() => {});
    this.complete = true;
    this.nodes = [];
    this.syndrome = null;
    this.side = 'L';
    this.tempo = 'subacute';

    this.canvas = el('canvas', { style: { width: '100%', height: '660px', display: 'block' } });
    this.graph = new AnatomyGraph(this.canvas, {
      onSelect: (id, ids) => { this.syndrome = null; this.setLesion(ids, null); },
    });

    this.findingsNode = el('div', { class: 'findings' });
    this.summaryNode = el('div', { class: 'lesion-summary' });

    this.filterChips = el('div', { class: 'chips' },
      ...FILTERS.map((f) => el('button', {
        class: 'chip' + (f.id === 'all' ? ' on' : ''),
        onclick: (e) => {
          for (const b of this.filterChips.children) b.classList.remove('on');
          e.currentTarget.classList.add('on');
          this.graph.invalidate(); this.graph.setFilter(f.id);
        },
      }, f.label)));

    this.severity = el('div', { class: 'chips' },
      ...[['Complete', true], ['Partial', false]].map(([lbl, v]) => el('button', {
        class: 'chip' + (v === this.complete ? ' on' : ''),
        onclick: (e) => {
          for (const b of this.severity.children) b.classList.remove('on');
          e.currentTarget.classList.add('on');
          this.complete = v; this.refresh();
        },
      }, lbl)));

    this.sideChips = el('div', { class: 'chips' },
      ...['L', 'R'].map((s) => el('button', {
        class: 'chip' + (s === this.side ? ' on' : ''),
        onclick: (e) => {
          for (const b of this.sideChips.children) b.classList.remove('on');
          e.currentTarget.classList.add('on');
          this.side = s;
          if (this.syndrome) this.applySyndrome(this.syndrome);
        },
      }, s === 'L' ? 'Left' : 'Right')));

    this.siteSelect = this.buildSiteSelect();

    /* Tempo is a second axis. The examination localises; only the history dates
       the lesion, and the differential needs both. */
    this.tempoChips = el('div', { class: 'chips' },
      ...TEMPOS.map((t) => el('button', {
        class: 'chip' + (t.id === this.tempo ? ' on' : ''),
        title: t.note,
        onclick: (e) => {
          for (const b of this.tempoChips.children) b.classList.remove('on');
          e.currentTarget.classList.add('on');
          this.tempo = t.id; this.refresh();
        },
      }, t.label)));
    this.diffNode = el('div', { class: 'differential' });

    this.node = el('div', { class: 'split neuro-split' },
      el('div', { class: 'stack' },
        card('Where is the lesion?',
          'Click any structure. Pathways running through it light up; the interrupted segment is drawn broken.',
          el('div', { class: 'toolbar' }, this.filterChips),
          this.canvas),
        this.syndromeCard()),
      el('div', { class: 'stack' },
        card('Lesion',
          'Set the site directly, or pick it off the graph.',
          el('div', { class: 'toolbar wrap' },
            this.siteSelect,
            el('div', { class: 'toolbar-sub' },
              el('span', { class: 'eyebrow' }, 'Extent'), this.severity)),
          this.summaryNode),
        card('Time course',
          'The examination says where. Only the history says how fast — and the differential needs both.',
          this.tempoChips,
          this.diffNode),
        card('Predicted examination', 'Derived from the pathway geometry, not looked up.',
          this.findingsNode)),
    );

    this.setLesion(['L_ic'], null);
  }

  buildSiteSelect() {
    const sel = el('select', { class: 'select', onchange: (e) => {
      if (!e.target.value) return;
      this.syndrome = null;
      this.graph.select(e.target.value);
    } });
    sel.appendChild(el('option', { value: '' }, '— choose a structure —'));
    let lastLevel = null, group = null;
    for (const n of SITES) {
      if (n.level !== lastLevel) {
        lastLevel = n.level;
        group = el('optgroup', { label: LEVEL_LABEL[n.level] || n.level });
        sel.appendChild(group);
      }
      group.appendChild(el('option', { value: n.id }, n.name));
    }
    return sel;
  }

  syndromeCard() {
    const list = el('div', { class: 'syn-list' },
      ...SYNDROMES.map((s) => el('button', {
        class: 'syn', onclick: () => { this.applySyndrome(s); },
        data: { syn: s.id },
      },
        el('span', { class: 'syn-n' }, s.name),
        el('span', { class: 'syn-v' }, s.vessel))));
    this.synList = list;
    return card('Named syndromes',
      'These are territories, not single tracts. The findings are still derived — nothing here is a stored answer.',
      el('div', { class: 'toolbar' },
        el('span', { class: 'eyebrow' }, 'Side'), this.sideChips),
      list);
  }

  applySyndrome(s) {
    this.syndrome = s;
    for (const b of this.synList.children) b.classList.toggle('on', b.dataset.syn === s.id);
    const ids = s.nodes(this.side);
    this.graph.setCompound(ids, s.name);
    this.setLesion(ids, s);
  }

  setLesion(ids, syndrome) {
    this.nodes = ids.filter((id) => NODES[id]);
    if (!syndrome) for (const b of this.synList?.children || []) b.classList.remove('on');
    if (this.nodes.length === 1) this.siteSelect.value = this.nodes[0];
    this.refresh();
    // Publish via the Patient Runtime when available (condition.activate),
    // otherwise fall back to the legacy shared channel.
    const cord = cordLevelOf(this.nodes);
    if (this.patient.runtime) {
      // patient.set('cordLevel') is intercepted by the compatibility facade
      // and dispatched as condition.activate / condition.resolve.
      this.patient.set('cordLevel', cord, 'neuro');
    } else {
      this.patient.set('cordLevel', cord);
    }
    this.onLesion({ nodes: this.nodes, syndrome, cordLevel: cord });
  }

  refresh() {
    const findings = guard('neuro.localise', () => findingsForNodes(this.nodes, this.complete)) || [];
    this.spared = guard('neuro.spared', () => sparedForNodes(this.nodes, this.complete)) || [];
    guard('neuro.summary', () => this.renderSummary(findings));
    guard('neuro.findings', () => this.renderFindings(findings));
  }

  renderSummary(findings) {
    clear(this.summaryNode);
    const s = this.syndrome;
    const title = s ? s.name : (this.nodes.length === 1 ? NODES[this.nodes[0]].name : `${this.nodes.length} structures`);

    const sides = new Set(findings.map((f) => f.side));
    const umn = findings.some((f) => f.umnOrLmn === 'UMN');
    const lmn = findings.some((f) => f.umnOrLmn === 'LMN');
    const cord = cordLevelOf(this.nodes);

    this.summaryNode.append(
      el('div', { class: 'ls-title' }, title),
      s && el('p', { class: 'ls-pearl' }, s.pearl),
      el('div', { class: 'ls-tags' },
        el('span', { class: 'tag' }, `${findings.length} affected pathways`),
        sides.has('L') && sides.has('R') && el('span', { class: 'tag warn' }, 'Crossed / bilateral findings'),
        umn && el('span', { class: 'tag umn' }, 'UMN signs'),
        lmn && el('span', { class: 'tag lmn' }, 'LMN signs'),
        cord && el('span', { class: 'tag' }, `Cord level ${cord}`)),
      cord && this.cordWarning(cord),
    );
  }

  cordWarning(cord) {
    const rank = ['C1','C2','C3','C4','C5','C6','C7','C8','T1','T2','T3','T4','T5','T6'];
    if (!rank.includes(cord)) return null;
    return el('p', { class: 'callout danger' },
      `A lesion at ${cord} is above the sympathetic outflow to the heart and vessels. `
      + 'The cardiovascular workspace is now showing neurogenic shock — hypotension with a '
      + 'slow pulse, which is what separates it from haemorrhage.');
  }

  renderFindings(findings) {
    clear(this.findingsNode);
    if (!findings.length) {
      this.findingsNode.append(el('p', { class: 'empty' },
        'No modelled pathway runs through this structure — the examination would be normal.'));
      return;
    }
    if (this.spared && this.spared.length) {
      this.findingsNode.append(
        el('div', { class: 'sec-head' }, 'Spared despite being in the lesion'),
        ...this.spared.map((f) => el('div', { class: 'spared-row' },
          el('span', { class: `side-pill ${f.side}` }, f.side === 'B' ? 'Bilat' : f.side),
          el('span', { class: 'sp-r' }, fmt.title(f.bodyRegion)),
          el('span', { class: 'sp-w' }, f.reason))));
    }
    for (const g of groupFindings(findings)) {
      const byRegion = new Map();
      for (const f of g.items) {
        const k = `${f.side}|${f.modality}|${f.umnOrLmn}|${f.deficit}`;
        if (!byRegion.has(k)) byRegion.set(k, { ...f, regions: [] });
        byRegion.get(k).regions.push(f.bodyRegion);
      }
      this.findingsNode.append(
        el('div', { class: 'sec-head' }, g.label),
        ...[...byRegion.values()].map((f) => el('div', { class: 'finding-row' },
          el('div', { class: 'fr-top' },
            el('span', { class: `side-pill ${f.side}` }, f.side === 'B' ? 'Bilat' : f.side),
            el('span', { class: 'fr-region' }, this.regionSummary(f.regions)),
            f.umnOrLmn !== 'N/A' && el('span', { class: `tag ${f.umnOrLmn.toLowerCase()}` }, f.umnOrLmn),
            el('span', { class: 'fr-mod' }, MODALITY_LABEL[f.modality] || f.modality)),
          el('div', { class: 'fr-def' }, f.deficit),
          el('div', { class: 'fr-test' }, f.testMethod))),
      );
    }
  }

  /* "R_dermatome_C5, R_dermatome_C6, ..." reads badly. Collapse to a range. */
  regionSummary(regions) {
    if (regions.length === 1) return fmt.title(regions[0]);
    const segs = [];
    let stem = null;
    for (const r of regions) {
      const m = /^(.*?)_((?:C|T|L|S)\d{1,2})$/.exec(r);
      if (m) { stem = m[1]; segs.push(m[2]); } else segs.push(r);
    }
    if (stem && segs.length > 1) return `${fmt.title(stem)} ${segs[0]}–${segs[segs.length - 1]}`;
    return regions.map(fmt.title).join(', ');
  }

  resize() { guard('neuro.graph', () => { this.graph.invalidate(); this.graph.draw(); }); }
  draw() { guard('neuro.graph', () => this.graph.draw()); }
}
