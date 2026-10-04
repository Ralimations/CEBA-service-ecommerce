'use client';
import { useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/ui';
export function Handshake({
  itemId,
  gate,
  issue,
}: {
  itemId: string;
  gate: 'START' | 'COMPLETE';
  issue: boolean;
}) {
  const [code, setCode] = useState('');
  const [image, setImage] = useState('');
  const [expires, setExpires] = useState('');
  return (
    <div className="handshake">
      <h4>
        <QrCode size={18} />
        {gate === 'START' ? 'Gate 1 · Service check-in' : 'Gate 2 · Service completion'}
      </h4>
      {issue ? (
        <>
          <p>
            {gate === 'START'
              ? 'Generate a code for this provider to verify when the service starts.'
              : 'Generate a code for your customer to verify after this service is complete.'}
          </p>
          <ActionForm
            action="handshake.issue"
            data={{ itemId, gate }}
            onResult={(result) => {
              if (result.code) {
                setCode(result.code);
                setExpires(result.expires || '');
                void QRCode.toDataURL(result.code, {
                  width: 192,
                  margin: 2,
                  color: { dark: '#163f35', light: '#ffffff' },
                }).then(setImage);
              }
            }}
          >
            <button className="btn secondary" type="submit">
              {code ? 'Replace verification code' : 'Generate QR & code'}
            </button>
          </ActionForm>
          {code && (
            <div className="qr-result">
              {image && (
                <img
                  src={image}
                  alt={`${gate === 'START' ? 'Check-in' : 'Completion'} verification QR code`}
                />
              )}
              <strong className="verification-code">{code}</strong>
              <p>Manual fallback: share this code with the other party.</p>
              <small>
                One use · Expires{' '}
                {new Date(expires).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })}{' '}
                Philippine time
              </small>
            </div>
          )}
        </>
      ) : (
        <>
          <p>
            {gate === 'START'
              ? 'Ask the customer for their check-in code.'
              : 'Only confirm after this provider has delivered the agreed service.'}
          </p>
          <ActionForm
            action="handshake.verify"
            data={{ itemId, gate }}
            confirm={
              gate === 'COMPLETE'
                ? 'Confirm that this supplier has completed the agreed service. Funds release when all suppliers are complete.'
                : undefined
            }
          >
            <Field label="Enter verification code">
              <input
                name="code"
                required
                autoComplete="off"
                minLength={12}
                maxLength={12}
                placeholder="12-character one-time code"
              />
            </Field>
            <button className="btn" type="submit">
              {gate === 'START' ? 'Verify & start service' : 'Verify service completion'}
            </button>
          </ActionForm>
        </>
      )}
    </div>
  );
}
