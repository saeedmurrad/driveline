import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';

type LegalPage = 'privacy-policy' | 'cookie-policy' | 'disclaimer' | 'sitemap';

@Component({
  selector: 'app-legal',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './legal.html',
  styleUrl: './legal.css',
})
export class LegalComponent implements OnInit {
  private route = inject(ActivatedRoute);
  currentPage = signal<LegalPage>('privacy-policy');

  pageContent: Record<LegalPage, { title: string; sections: { heading: string; body: string }[] }> = {
    'privacy-policy': {
      title: 'Privacy Policy',
      sections: [
        {
          heading: 'Introduction',
          body: 'The purpose of this policy is to outline the steps DriveLine take to ensure the privacy of users of this website. If you have any questions relating to the way in which DriveLine handles data and information of users then please contact us via the details on the contact page.',
        },
        {
          heading: 'GDPR Compliance',
          body: 'DriveLine as a data controller is committed to ensuring the data processed through this website is done so in a manner appropriate to the General Data Protection Regulation (GDPR) which took effect on May 25th 2018.',
        },
        {
          heading: 'Type of Data We Collect',
          body: 'This section outlines the type of data and information collected through this website and the steps available to users to request access, amendment and removal of data.',
        },
        {
          heading: 'Google Analytics',
          body: 'This website uses Google Analytics to collect information about visitor behaviour to inform business decisions. This information is anonymous and does not allow identification of individual users.',
        },
        {
          heading: 'Personal Information via Enquiry Forms',
          body: 'If a user submits an enquiry via a form on this website then details including name, email address, phone number and any additional information provided will be sent to DriveLine and stored for future reference. This information will not be shared with any other parties or used without consent.',
        },
        {
          heading: 'Your Rights',
          body: 'Under the General Data Protection Regulation, data subjects have the right to access, amend and erase information. You can request access, amendments or erasure of your data by contacting DriveLine directly.',
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
          heading: 'How DriveLine Uses Cookies',
          body: 'When a user accesses this website, it may place a number of cookie files in the user\'s web browser. This website uses cookies to enable certain functions of the service, to provide analytics and store user preferences.',
        },
        {
          heading: 'Third-Party Cookies',
          body: 'In addition to our own cookies, we may also use various third-party cookies to report usage statistics of the service, including Google Analytics.',
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
          body: 'The information contained in this website is for general information purposes only. The information is provided by DriveLine and while we endeavour to keep the information up to date and correct, we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability or availability.',
        },
        {
          heading: 'Limitation of Liability',
          body: 'In no event will we be liable for any loss or damage including without limitation, indirect or consequential loss or damage, or any loss or damage whatsoever arising from loss of data or profits arising out of, or in connection with, the use of this website.',
        },
        {
          heading: 'External Links',
          body: 'Through this website you are able to link to other websites which are not under the control of DriveLine. We have no control over the nature, content and availability of those sites. The inclusion of any links does not necessarily imply a recommendation or endorse the views expressed within them.',
        },
        {
          heading: 'Availability',
          body: 'Every effort is made to keep the website up and running smoothly. However, DriveLine takes no responsibility for, and will not be liable for, the website being temporarily unavailable due to technical issues beyond our control.',
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
      if (page && this.pageContent[page]) {
        this.currentPage.set(page);
      }
    });
  }

  get content() {
    return this.pageContent[this.currentPage()];
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
