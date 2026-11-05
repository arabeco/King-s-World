import assert from 'node:assert/strict';

// Check the rendered text, including child labels and cost badges, against every
// stop of the shared button gradients. Image artwork is intentionally excluded.
export async function auditButtonContrast(page, screen) {
  const results = await page.evaluate(() => {
    const rgba = value => {
      const parts = value.match(/[\d.]+/g)?.map(Number);
      return parts?.length >= 3 ? [...parts.slice(0, 3), parts[3] ?? 1] : null;
    };
    const over = (a, b) => a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1-a[3]));
    const luminance = color => color.slice(0, 3).reduce((sum, v, i) => {
      v /= 255;
      return sum + (v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4) * [.2126,.7152,.0722][i];
    }, 0);
    const ratio = (a,b) => {
      const x=luminance(a),y=luminance(b);
      return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
    };
    // Resolve CSS variables through the browser rather than duplicating tokens.
    const probe = document.createElement('span');
    document.body.append(probe);
    const gradients = ['--kw-action-gold','--kw-action-secondary'].map(token => {
      probe.style.background=`var(${token})`;
      return getComputedStyle(probe).backgroundImage;
    });
    probe.remove();
    const rows=[];
    for (const button of document.querySelectorAll('button, a.primary-button, a.secondary-button')) {
      const rect=button.getBoundingClientRect(), style=getComputedStyle(button);
      if (!rect.width || !rect.height || rect.bottom<0 || rect.top>innerHeight || style.visibility==='hidden') continue;
      const disabled=button.matches(':disabled,[aria-disabled="true"]');
      if (!disabled && !gradients.includes(style.backgroundImage)) continue;
      const stops=disabled ? [rgba(style.backgroundColor)] : [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(match=>rgba(match[0]));
      const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);
      let text;
      while ((text=walker.nextNode())) {
        if (!text.textContent.trim()) continue;
        const parent=text.parentElement, bounds=parent.getBoundingClientRect();
        if (bounds.width<2 || bounds.height<2 || parent.closest('svg')) continue;
        const foreground=rgba(getComputedStyle(parent).color);
        if (!foreground) continue;
        const overlays=[];
        for(let el=parent;el!==button;el=el.parentElement) {
          const bg=rgba(getComputedStyle(el).backgroundColor);
          if(bg) overlays.unshift(bg);
        }
        const minimum=Math.min(...stops.filter(Boolean).map(stop=>{
          const bg=overlays.reduce((background,overlay)=>over(overlay,background),stop);
          return ratio(over(foreground,bg),bg);
        }));
        rows.push({label:text.textContent.trim(),kind:disabled?'disabled':style.backgroundImage===gradients[0]?'gold':'secondary',minimum:Number(minimum.toFixed(2)),opacity:style.opacity});
      }
    }
    return rows;
  });
  for (const row of results) {
    assert.ok(row.minimum>=4.5,`${screen}: ${JSON.stringify(row)}`);
    assert.equal(row.opacity,'1',`${screen}: button text must not be faded`);
  }
  return {screen,labels:results.length,minimum:results.length?Math.min(...results.map(r=>r.minimum)):null};
}
