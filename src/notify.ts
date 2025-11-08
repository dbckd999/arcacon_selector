'use strict';

// Shoelace 컴포넌트의 타입 정의를 가져옵니다.
import '@shoelace-style/shoelace/dist/components/alert/alert.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';

type AlertVariant = 'primary' | 'success' | 'neutral' | 'warning' | 'danger';

export function notify(
  message='빈 메시지', 
  variant:AlertVariant = 'primary', 
  icon = 'info-circle', 
  duration = 3000) {
  const alert = Object.assign(document.createElement('sl-alert'), {
    variant,
    closable: true,
    duration: duration,
    innerHTML: `
        <sl-icon name="${icon}" slot="icon"></sl-icon>
        <div>${message}</div>
      `
  });

  document.body.append(alert);
  return alert.toast();
}

export function createBase():void{
  const alertToastWrapper = document.createElement('div');
  alertToastWrapper.className='alert-toast-wrapper';
  document.body.prepend(alertToastWrapper);
}