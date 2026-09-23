// ============================================================
// dialog.js — Custom modal (ganti prompt/confirm/alert bawaan)
// ============================================================

(function(){
  let _resolve = null;
  let _mode = null;

  function $(id){ return document.getElementById(id); }

  function openDialog({title, bodyHTML, okText, cancelText, danger, mode, onOpen}){
    return new Promise(resolve => {
      _resolve = resolve;
      _mode = mode || 'default';

      const modal = $('dlg-modal');
      const titleEl = $('dlg-title');
      const bodyEl = $('dlg-body');
      const okBtn = $('dlg-ok');
      const cancelBtn = $('dlg-cancel');

      titleEl.textContent = title || 'Konfirmasi';
      bodyEl.innerHTML = bodyHTML || '';
      okBtn.textContent = okText || 'OK';
      cancelBtn.textContent = cancelText || 'Batal';

      if(danger){
        okBtn.className = 'bt';
        okBtn.style.background = 'var(--dg)';
        okBtn.style.color = '#fff';
        okBtn.style.border = '1px solid var(--dg)';
      } else {
        okBtn.className = 'bt bp';
        okBtn.style.background = '';
        okBtn.style.color = '';
        okBtn.style.border = '';
      }

      if(cancelText === null){
        cancelBtn.style.display = 'none';
      } else {
        cancelBtn.style.display = '';
      }

      modal.classList.remove('hide');
      if(onOpen) setTimeout(onOpen, 60);
    });
  }

  function closeDialog(result){
    const modal = $('dlg-modal');
    if(modal) modal.classList.add('hide');
    if(_resolve){
      const r = _resolve;
      _resolve = null;
      _mode = null;
      r(result);
    }
  }

  function bindOnce(){
    const modal = $('dlg-modal');
    if(!modal || modal.dataset.bound) return;
    modal.dataset.bound = '1';

    $('dlg-close').addEventListener('click', () => closeDialog(null));
    $('dlg-cancel').addEventListener('click', () => closeDialog(null));

    $('dlg-ok').addEventListener('click', () => {
      if(_mode === 'prompt'){
        const inp = $('dlg-input');
        closeDialog(inp ? inp.value : null);
      } else if(_mode === 'choose'){
        const sel = document.querySelector('input[name="dlg-choice"]:checked');
        closeDialog(sel ? sel.value : null);
      } else {
        closeDialog(true);
      }
    });

    modal.addEventListener('click', (e) => {
      if(e.target === modal) closeDialog(null);
    });

    // Enter = OK
    modal.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' && e.target.tagName !== 'TEXTAREA'){
        e.preventDefault();
        $('dlg-ok').click();
      }
    });
  }

  const dlg = {
    // Info saja
    alert({title, message, okText}){
      bindOnce();
      return openDialog({
        title: title || 'Info',
        bodyHTML: `<div style="text-align:center;padding:6px 0">
          <div style="font-size:44px;margin-bottom:12px">ℹ️</div>
          <div style="font-size:14px;line-height:1.6;white-space:pre-line">${message || ''}</div>
        </div>`,
        okText: okText || 'OK',
        cancelText: null,
        mode: 'alert'
      });
    },

    // Ya / Batal
    confirm({title, message, okText, cancelText, danger}){
      bindOnce();
      return openDialog({
        title: title || 'Konfirmasi',
        bodyHTML: `<div style="text-align:center;padding:6px 0">
          <div style="font-size:44px;margin-bottom:12px">${danger ? '⚠️' : '❓'}</div>
          <div style="font-size:14px;line-height:1.6;white-space:pre-line">${message || ''}</div>
        </div>`,
        okText: okText || 'Ya',
        cancelText: cancelText || 'Batal',
        danger: !!danger,
        mode: 'confirm'
      });
    },

    // Input teks / password / number
    prompt({title, label, message, placeholder, value, type, min, max, okText}){
      bindOnce();
      const inputType = type || 'text';
      const valAttr = value !== undefined ? ` value="${String(value).replace(/"/g,'&quot;')}"` : '';
      const minAttr = min !== undefined ? ` min="${min}"` : '';
      const maxAttr = max !== undefined ? ` max="${max}"` : '';
      const isPassword = inputType === 'password';

      const bodyHTML = `
        <div style="padding:2px 0">
          ${message ? `<div class="mt" style="margin-bottom:14px;font-size:13px;color:var(--mt);text-align:center">${message}</div>` : ''}
          <div class="fr" style="margin:0">
            <label for="dlg-input">${label || 'Input'}</label>
            <div style="position:relative">
              <input id="dlg-input" type="${inputType}" placeholder="${placeholder || ''}"${valAttr}${minAttr}${maxAttr}
                style="padding-right:${isPassword ? '46px' : '13px'}">
              ${isPassword ? `<button type="button" id="dlg-eye" aria-label="Tampilkan"
                style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:20px;cursor:pointer;padding:6px 10px;line-height:1">👁️</button>` : ''}
            </div>
          </div>
          <div id="dlg-err" class="mt" style="color:var(--dg);margin-top:8px;min-height:16px;text-align:center"></div>
        </div>
      `;

      return openDialog({
        title: title || 'Input',
        bodyHTML,
        okText: okText || 'Simpan',
        cancelText: 'Batal',
        mode: 'prompt',
        onOpen: () => {
          const inp = $('dlg-input');
          if(inp){ inp.focus(); inp.select(); }
          const eye = $('dlg-eye');
          if(eye){
            eye.addEventListener('click', () => {
              const i = $('dlg-input');
              if(i){
                i.type = i.type === 'password' ? 'text' : 'password';
                eye.textContent = i.type === 'password' ? '👁️' : '🙈';
              }
            });
          }
        }
      });
    },

    // Pilih dari beberapa opsi (radio)
    choose({title, message, options, value, okText}){
      bindOnce();
      const opts = options || [];
      const bodyHTML = `
        <div style="padding:2px 0">
          ${message ? `<div class="mt" style="margin-bottom:14px;font-size:13px;color:var(--mt);text-align:center">${message}</div>` : ''}
          <div style="display:flex;flex-direction:column;gap:10px">
            ${opts.map(o => `
              <label class="dlg-opt" style="display:flex;gap:12px;align-items:flex-start;padding:14px;border:1px solid var(--bd);border-radius:12px;cursor:pointer;background:var(--sur);transition:.15s">
                <input type="radio" name="dlg-choice" value="${o.value}" ${o.value === value ? 'checked' : ''} style="margin-top:4px;accent-color:var(--pr);flex-shrink:0">
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:14px;color:var(--tx)">${o.label}</div>
                  ${o.desc ? `<div class="mt" style="margin-top:3px">${o.desc}</div>` : ''}
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      `;

      return openDialog({
        title: title || 'Pilih',
        bodyHTML,
        okText: okText || 'Simpan',
        cancelText: 'Batal',
        mode: 'choose',
        onOpen: () => {
          const first = document.querySelector('input[name="dlg-choice"]');
          if(first) first.focus();
          // Klik di area label = pilih radio
          document.querySelectorAll('.dlg-opt').forEach(el => {
            el.addEventListener('click', () => {
              const r = el.querySelector('input[type=radio]');
              if(r) r.checked = true;
            });
          });
        }
      });
    }
  };

  window.dlg = dlg;
  console.log('✅ dialog.js loaded');
})();
