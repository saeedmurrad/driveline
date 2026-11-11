import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { DealerContextService } from '../../services/dealer-context.service';

type LegalPage = 'privacy-policy' | 'cookie-policy' | 'disclaimer' | 'sitemap';

@Component({
  selector: 'app-legal',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './legal.html',
  styleUrl: './legal.css',
})
export class LegalComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private dealerContext = inject(DealerContextService);
  dealerName = this.dealerContext.dealerName;
  currentPage = signal<LegalPage>('privacy-policy');

  private readonly pageContentRaw: Record<LegalPage, { title: string; sections: { heading: string; body: string }[] }> = {
    'privacy-policy': {
      title: 'Privacy Policy',
      sections: [
        {
          heading: 'Introduction',
          body: 'The purpose of this policy is to outline the steps we take to ensure the privacy of users of this website. If you have any questions relating to the way in which we handle data and information of users then please contact us via the details on the contact page.',
        },
        {
          heading: 'GDPR Compliance',
          body: 'We as a data controller are committed to ensuring the data processed through this website is done so in a manner appropriate to the General Data Protection Regulation (GDPR) which took effect on May 25th 2018.',
        },
        {
          heading: 'Type of Data We Collect',
          body: 'This section outlines the type of data and information collected through this website and the steps available to users to request access, amendment and removal of data.',
        },
        {
          heading: 'Visitor Statistics',
          body: 'We count visits to this website so we know which pages and vehicles people look at and how they found us (for example Google or Facebook). We do this without cookies and without storing anything on your device: each page view only adds one to an anonymous daily total (page, vehicle viewed, the website you came from, and whether you use a phone, tablet or computer). No IP address, name or other information that could identify you is kept. We do not use Google Analytics or advertising trackers.',
        },
        {
          heading: 'Personal Information via Enquiry Forms',
          body: 'If you send an enquiry through a form on this website, the details you give (such as your name, email address, phone number, the vehicle you are interested in and your message) are stored securely in our enquiry system so our sales team can reply and keep track of it. The system runs on Google Firebase, with data held in London, UK; only DriveLine staff can read it. We use these details only to deal with your enquiry and will not share them with anyone else or use them for marketing without your consent.',
        },
        {
          heading: 'Your Rights',
          body: 'Under the General Data Protection Regulation, data subjects have the right to access, amend and erase information. You can request access, amendments or erasure of your data by contacting us directly.',
        },
      ],
    },
    'cookie-policy': {
      title: 'Cookie Policy',
      sections: [
        {
          heading: 'What Are Cookies',
          body: 'Cookies are small pieces of data stored on a user\'s device by a website, which help enhance the browsing experience. A cookie file is stored in a browser and allows a third-party to recognise an anonymous user.',
        },
        {
          heading: 'How We Use Cookies',
          body: 'This website does not use advertising or tracking cookies, and our visitor statistics work without cookies. We only store a few small settings in your own browser so features work: vehicles you save or add to compare, recently viewed vehicles, the last photo you looked at, your light or dark mode choice and your cookie notice choice. Staff who sign in to our admin area also get a sign-in record from Google Firebase. These never leave your device, and you can clear them at any time in your browser settings.',
        },
        {
          heading: 'Third-Party Cookies',
          body: 'Our contact page shows a Google map, which may set their own cookies under their own policies. We do not use Google Analytics.',
        },
        {
          heading: 'Managing Cookies',
          body: 'The ability to enable, disable or delete cookies can be completed at the browser level. Please note that if you delete cookies or refuse to accept them, you might not be able to use all of the features this website offers.',
        },
      ],
    },
    'disclaimer': {
      title: 'Disclaimer',
      sections: [
        {
          heading: 'General Information',
          body: 'The information contained in this website is for general information purposes only. While we endeavour to keep the information up to date and correct, we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability or availability.',
        },
        {
          heading: 'Limitation of Liability',
          body: 'In no event will we be liable for any loss or damage including without limitation, indirect or consequential loss or damage, or any loss or damage whatsoever arising from loss of data or profits arising out of, or in connection with, the use of this website.',
        },
        {
          heading: 'External Links',
          body: 'Through this website you are able to link to other websites which are not under our control. We have no control over the nature, content and availability of those sites. The inclusion of any links does not necessarily imply a recommendation or endorse the views expressed within them.',
        },
        {
          heading: 'Availability',
          body: 'Every effort is made to keep the website up and running smoothly. However, we take no responsibility for, and will not be liable for, the website being temporarily unavailable due to technical issues beyond our control.',
        },
      ],
    },
    'sitemap': {
      title: 'Sitemap',
      sections: [
        {
          heading: 'All Pages',
          body: '',
        },
      ],
    },
  };

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const page = params.get('page') as LegalPage;
      if (page && this.pageContentRaw[page]) {
        this.currentPage.set(page);
      }
    });
  }

  get content() {
    return this.pageContentRaw[this.currentPage()];
  }

  sitemapLinks = [
    { section: 'Vehicles', links: [
      { label: 'Used Cars', route: '/cars' },
      { label: 'Used Vans', route: '/vans' },
    ]},
    { section: 'Services', links: [
      { label: 'Finance', route: '/finance' },
      { label: 'Warranty', route: '/warranty' },
      { label: 'Sell Your Car', route: '/sell-your-car' },
      { label: 'Part Exchange', route: '/part-exchange' },
      { label: 'Delivery & Collection', route: '/delivery' },
      { label: 'FAQ', route: '/faq' },
    ]},
    { section: 'Company', links: [
      { label: 'Reviews', route: '/reviews' },
      { label: 'Contact Us', route: '/contact' },
    ]},
    { section: 'Legal', links: [
      { label: 'Privacy Policy', route: '/legal/privacy-policy' },
      { label: 'Cookie Policy', route: '/legal/cookie-policy' },
      { label: 'Disclaimer', route: '/legal/disclaimer' },
    ]},
  ];
}
