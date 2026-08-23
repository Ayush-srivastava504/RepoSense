// Module: app/components/InternshipDetailAds.tsx
// Defines component(s)/export(s): NATIVE_AD_CONTAINER, InternshipDetailAds
//
//

'use client';
import Script from 'next/script';
const NATIVE_AD_CONTAINER = 'container-0ecc31c4385791c7fa0bcc3db25e36c9';
export default function InternshipDetailAds() {
    return (<>
      <Script id="internship-detail-vignette" strategy="afterInteractive">
        {`
          (function(s) {
            s.dataset.zone = '11238201';
            s.src = 'https://n6wxm.com/vignette.min.js';
          })(
            [document.documentElement, document.body]
              .filter(Boolean)
              .pop()
              .appendChild(document.createElement('script'))
          );
        `}
      </Script>

      <section className="mx-auto w-full max-w-3xl px-3 sm:px-4 pb-8 sm:pb-12">
        <div className="w-full overflow-hidden rounded-lg" style={{
            minHeight: '70px',
        }}>
          <div id={NATIVE_AD_CONTAINER}/>
        </div>
      </section>

      <Script id="internship-detail-native-banner" async data-cfasync="false" src="https://pl30201817.effectivecpmnetwork.com/0ecc31c4385791c7fa0bcc3db25e36c9/invoke.js" strategy="afterInteractive"/>
    </>);
}
