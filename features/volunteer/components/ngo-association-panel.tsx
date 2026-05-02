'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, MailPlus, Unlink } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useVolunteerDashboard } from '@/features/volunteer/context/volunteer-dashboard-context';

type NgoDirectoryItem = {
  id: string;
  organizationId: string;
  name: string;
  region?: string | null;
};

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

export function VolunteerNgoAssociationPanel() {
  const { profile } = useAuth();
  const { associatedNgoIds } = useVolunteerDashboard();
  const [ngos, setNgos] = useState<NgoDirectoryItem[]>([]);
  const [pendingInvites, setPendingInvites] = useState<InviteRecord[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequestRecord[]>([]);
  const [selectedNgoId, setSelectedNgoId] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');

  const email = profile?.email?.toLowerCase() ?? '';
  const volunteerId = profile?.uid ?? '';
  const ngoById = useMemo(() => new Map(ngos.map((ngo) => [ngo.organizationId, ngo])), [ngos]);

  const loadInvites = useCallback(async () => {
    if (!email) {
      setPendingInvites([]);
      return;
    }

    const response = await fetch(`/api/ngo/invites?email=${encodeURIComponent(email)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to load NGO invites.');
    }

    setPendingInvites(Array.isArray(data.invites) ? data.invites.filter((invite: InviteRecord) => invite.status === 'pending') : []);
  }, [email]);

  const loadJoinRequests = useCallback(async () => {
    if (!volunteerId) {
      setJoinRequests([]);
      return;
    }

    const response = await fetch(`/api/ngo/join-requests?volunteerId=${encodeURIComponent(volunteerId)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to load join requests.');
    }

    setJoinRequests(Array.isArray(data.joinRequests) ? data.joinRequests : []);
  }, [volunteerId]);

  useEffect(() => {
    const loadDirectory = async () => {
      try {
        const response = await fetch('/api/ngo/directory', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to load NGO directory.');
        }
        setNgos(Array.isArray(data.ngos) ? data.ngos : []);
      } catch (error) {
        console.error(error);
      }
    };

    void loadDirectory();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await loadInvites();
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
  }, [email, loadInvites]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await loadJoinRequests();
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
  }, [loadJoinRequests, volunteerId]);

  const availableNgos = ngos.filter((ngo) => !associatedNgoIds.includes(ngo.organizationId));
  const visiblePendingInvites = email ? pendingInvites : [];
  const visibleJoinRequests = volunteerId ? joinRequests : [];

  const handleInviteAction = async (inviteId: string, action: 'accept' | 'reject') => {
    if (!volunteerId && action === 'accept') return;

    try {
      setBusyAction(`${action}-${inviteId}`);
      setMessage('');
      const response = await fetch('/api/ngo/invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteId,
          action,
          volunteerId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to update invite.');
      }
      await loadInvites();
      setMessage(action === 'accept' ? 'NGO invite accepted.' : 'Invite rejected.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update invite.');
    } finally {
      setBusyAction('');
    }
  };

  const handleJoinRequest = async () => {
    if (!volunteerId || !selectedNgoId) return;

    try {
      setBusyAction(`join-${selectedNgoId}`);
      setMessage('');
      const response = await fetch('/api/ngo/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngoId: selectedNgoId,
          volunteerId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to send join request.');
      }
      await loadJoinRequests();
      setMessage('Join request sent to the NGO.');
      setSelectedNgoId('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to send join request.');
    } finally {
      setBusyAction('');
    }
  };

  const handleLeaveNgo = async (ngoId: string) => {
    if (!volunteerId) return;

    try {
      setBusyAction(`leave-${ngoId}`);
      setMessage('');
      const response = await fetch('/api/ngo/associations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volunteerId,
          ngoId,
          action: 'leave',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to leave NGO.');
      }
      await loadInvites();
      await loadJoinRequests();
      setMessage('NGO association removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to leave NGO.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="theme-card rounded-[2rem] p-6">
        <div className="flex items-center gap-3">
          <MailPlus className="h-5 w-5 text-primary-blue" />
          <h2 className="theme-title-24 text-dark-slate">NGO Invitations</h2>
        </div>
        <p className="mt-2 text-sm font-medium text-light-slate">If an NGO invites you by email, it appears here the moment you log in.</p>

        <div className="mt-5 space-y-3">
          {visiblePendingInvites.map((invite) => (
            <div key={invite.id} className="theme-soft rounded-2xl p-4">
              <p className="text-sm font-black text-dark-slate">{ngoById.get(invite.ngo_id)?.name ?? invite.ngo_id}</p>
              <p className="mt-1 text-xs font-medium text-light-slate">Invitation linked to {invite.email}</p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => void handleInviteAction(invite.id, 'accept')}
                  disabled={busyAction === `accept-${invite.id}`}
                  className="theme-primary rounded-full px-4 py-2 text-sm font-bold"
                >
                  Accept
                </button>
                <button
                  onClick={() => void handleInviteAction(invite.id, 'reject')}
                  disabled={busyAction === `reject-${invite.id}`}
                  className="theme-pill rounded-full px-4 py-2 text-sm font-bold"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}

          {visiblePendingInvites.length === 0 && (
            <div className="theme-soft rounded-2xl p-4 text-sm font-medium text-light-slate">
              No pending NGO invites right now.
            </div>
          )}
        </div>
      </div>

      <div className="theme-card rounded-[2rem] p-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary-blue" />
          <h2 className="theme-title-24 text-dark-slate">Your NGO Links</h2>
        </div>
        <p className="mt-2 text-sm font-medium text-light-slate">Volunteers can belong to multiple NGOs and still accept only one active case at a time.</p>

        {message && (
          <div className="mt-4 rounded-2xl border border-brand-blue-100 bg-brand-blue-50 p-4 text-sm font-bold text-primary-blue">
            {message}
          </div>
        )}

        <div className="mt-5 space-y-3">
          {associatedNgoIds.map((ngoId) => (
            <div key={ngoId} className="theme-soft flex items-center justify-between gap-3 rounded-2xl p-4">
              <div>
                <p className="text-sm font-black text-dark-slate">{ngoById.get(ngoId)?.name ?? ngoId}</p>
                <p className="mt-1 text-xs font-medium text-light-slate">{ngoById.get(ngoId)?.region ?? 'Linked NGO'}</p>
              </div>
              <button
                onClick={() => void handleLeaveNgo(ngoId)}
                disabled={busyAction === `leave-${ngoId}`}
                className="rounded-full border border-surface-200 p-2 text-light-slate transition-colors hover:text-rose-600"
                title="Leave NGO"
              >
                <Unlink className="h-4 w-4" />
              </button>
            </div>
          ))}

          {associatedNgoIds.length === 0 && (
            <div className="theme-soft rounded-2xl p-4 text-sm font-medium text-light-slate">
              You are currently working as an independent volunteer.
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-surface-200 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-light-slate">Request to join an NGO</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <select
              value={selectedNgoId}
              onChange={(event) => setSelectedNgoId(event.target.value)}
              className="flex-1 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-medium text-dark-slate"
            >
              <option value="">Choose an NGO</option>
              {availableNgos.map((ngo) => (
                <option key={ngo.organizationId} value={ngo.organizationId}>
                  {ngo.name}{ngo.region ? ` - ${ngo.region}` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => void handleJoinRequest()}
              disabled={!selectedNgoId || busyAction === `join-${selectedNgoId}`}
              className="theme-primary rounded-full px-4 py-2 text-sm font-bold disabled:bg-brand-slate-100 disabled:text-light-slate"
            >
              Request to Join
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {visibleJoinRequests
              .filter((request) => request.status === 'pending')
              .map((request) => (
                <span key={request.id} className="theme-pill rounded-full px-3 py-1 text-xs font-bold">
                  Pending: {ngoById.get(request.ngo_id)?.name ?? request.ngo_id}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
