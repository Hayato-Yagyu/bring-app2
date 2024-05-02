import * as sgMail from '@sendgrid/mail';

import React from 'react'



export const Send = () => {
    sgMail.setApiKey('YOUR_SENDGRID_API_KEY');
    const msg = {
    to: 'recipient@example.com',
    from: 'sender@example.com',
    subject: 'Test email',
    text: 'This is a test email sent from SendGrid using TypeScript.'
    };
    sgMail.send(msg)
  return (
    <div></div>
     
   )
}


