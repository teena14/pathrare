'use client';

import { useCallback, useMemo, useState } from 'react';
import { MailPlus, UserCheck, UserMinus } from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useNgoDashboard } from '@/features/ngo/context/ngo-dashboard-context';

type InviteRecord = {
  id: string;
  ngo_id: string;
  email: string;
  status: string;
};

type JoinRequestRecord = {
  id: string;
  ngo_id: string;
  volunteer_id: string;
  status: string;
};

export function NgoAssociationManager() {
  const { profile } = useAuth();
  const { refreshDashboard, volunteers } = useNgoDashboard();
  const profileRecord = (profile as unknown as Record<string, unknown> | null) ?? null;
  const [inviteEmail, setInviteEmail] = useState('');
  const [pendingInvites, setPendingInvites] = useState<InviteRecord[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<JoinRequestRecord[]>([]);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');

  const ngoId =
    (typeof profileRecord?.organization_id === 'string'
      ? String(profileRecord.organization_id)
      : profile?.uid) ?? '';

  const volunteerById = useMemo(() => new Map(volunteers.map((volunteer) => [volunteer.id, volunteer])), [volunteers]);

  const loadInvites = useCallback(async () => {
    if (!ngoId) {
      setPendingInvites([]);
      return;
    }

    const response = await fetch(`/api/ngo/invites?ngoId=${encodeURIComponent(ngoId)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to load NGO invites.');
    }

    setPendingInvites(Array.isArray(data.invites) ? data.invites.filter((invite: InviteRecord) => invite.status === 'pending') : []);
  }, [ngoId]);

  const loadJoinRequests = useCallback(async () => {
    if (!ngoId) {
      setPendingJoinRequests([]);
      return;
    }

    const response = await fetch(`/api/ngo/join-requests?ngoId=${encodeURIComponent(ngoId)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to load join requests.');
    }

    setPendingJoinRequests(Array.isArray(data.joinRequests) ? data.joinRequests.filter((request: JoinRequestRecord) => request.status === 'pending') : []);
  }, [ngoId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await Promise.all([loadInvites(), loadJoinRequests()]);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    };

    void run();
    const interval = window.setInterval(() => void run(), 12000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [loadInvites, loadJoinRequests, ngoId]);

  const handleInviteVolunteer = async () => {
    if (!ngoId || !inviteEmail.trim()) return;

    try {
      setBusyAction('invite');
      setMessage('');
      const response = await fetch('/api/ngo/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngoId,
          email: inviteEmail.trim().toLowerCase(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to send invite.');
      }
      await loadInvites();
      setInviteEmail('');
      setMessage('Volunteer invite sent.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to send invite.');
    } finally {
      setBusyAction('');
    }
  };

  const handleJoinRequestAction = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      setBusyAction(`${action}-${requestId}`);
      setMessage('');
      const response = await fetch('/api/ngo/join-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to update join request.');
      }
      await loadJoinRequests();
      await refreshDashboard();
      setMessage(action === 'approve' ? 'Volunteer linked to your NGO.' : 'Join request rejected.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update join request.');
    } finally {
      setBusyAction('');
    }
  };

  const handleRemoveVolunteer = async (volunteerId: string) => {
    try {
      setBusyAction(`remove-${volunteerId}`);
      setMessage('');
      const response = await fetch('/api/ngo/associations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volunteerId,
          ngoId,
          action: 'remove',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to remove volunteer from NGO.');
      }
      await refreshDashboard();
      setMessage('Volunteer removed from your NGO associations.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to remove volunteer.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="theme-card rounded-[2rem] p-6">
        <div className="flex items-center gap-3">
          <MailPlus className="h-5 w-5 text-primary-blue" />
          <h2 className="theme-title-24 text-dark-slate">Invite a Volunteer</h2>
        </div>
        <p className="mt-2 text-sm font-medium text-light-slate">Invite by email and the volunteer will see it on next login immediately.</p>
        {message && (
          <div className="mt-4 rounded-2xl border border-brand-blue-100 bg-brand-blue-50 p-4 text-sm font-bold text-primary-blue">
            {message}
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <input
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="volunteer@email.com"
            className="flex-1 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-medium text-dark-slate"
          />
          <button
            onClick={() => void handleInviteVolunteer()}
            disabled={!inviteEmail.trim() || busyAction === 'invite'}
            className="theme-primary rounded-full px-4 py-2 text-sm font-bold disabled:bg-brand-slate-100 disabled:text-light-slate"
          >
            Send Invite
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="theme-soft rounded-2xl p-4 text-sm font-medium text-light-slate">
              Pending invite: <span className="font-bold text-dark-slate">{invite.email}</span>
            </div>
          ))}
          {pendingInvites.length === 0 && (
            <div className="theme-soft rounded-2xl p-4 text-sm font-medium text-light-slate">
              No pending invites right now.
            </div>
          )}
        </div>
      </div>

      <div className="theme-card rounded-[2rem] p-6">
        <div className="flex items-center gap-3">
          <UserCheck className="h-5 w-5 text-primary-blue" />
          <h2 className="theme-title-24 text-dark-slate">Join Requests</h2>
        </div>
        <p className="mt-2 text-sm font-medium text-light-slate">Approve volunteer join requests to add your NGO to their `associated_ngo_ids`.</p>

        <div className="mt-5 space-y-3">
          {pendingJoinRequests.map((request) => {
            const volunteer = volunteerById.get(request.volunteer_id);
            return (
              <div key={request.id} className="theme-soft rounded-2xl p-4">
                <p className="text-sm font-black text-dark-slate">{volunteer?.name ?? request.volunteer_id}</p>
                <p className="mt-1 text-xs font-medium text-light-slate">{volunteer?.email ?? 'Volunteer account'}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => void handleJoinRequestAction(request.id, 'approve')}
                    disabled={busyAction === `approve-${request.id}`}
                    className="theme-primary rounded-full px-4 py-2 text-sm font-bold"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => void handleJoinRequestAction(request.id, 'reject')}
                    disabled={busyAction === `reject-${request.id}`}
                    className="theme-pill rounded-full px-4 py-2 text-sm font-bold"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}

          {pendingJoinRequests.length === 0 && (
            <div className="theme-soft rounded-2xl p-4 text-sm font-medium text-light-slate">
              No volunteer join requests are waiting right now.
            </div>
          )}
        </div>
      </div>

      <div className="theme-card rounded-[2rem] p-6">
        <div className="flex items-center gap-3">
          <UserMinus className="h-5 w-5 text-primary-blue" />
          <h2 className="theme-title-24 text-dark-slate">Linked Volunteers</h2>
        </div>
        <p className="mt-2 text-sm font-medium text-light-slate">Remove a volunteer here to drop your NGO from their `associated_ngo_ids`.</p>

        <div className="mt-5 space-y-3">
          {volunteers.map((volunteer) => (
            <div key={volunteer.id} className="theme-soft flex items-center justify-between gap-3 rounded-2xl p-4">
              <div>
                <p className="text-sm font-black text-dark-slate">{volunteer.name}</p>
                <p className="mt-1 text-xs font-medium text-light-slate">{volunteer.email ?? volunteer.region}</p>
              </div>
              <button
                onClick={() => void handleRemoveVolunteer(volunteer.id)}
                disabled={busyAction === `remove-${volunteer.id}`}
                className="rounded-full border border-surface-200 p-2 text-light-slate transition-colors hover:text-rose-600"
                title="Remove volunteer from NGO"
              >
                <UserMinus className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
