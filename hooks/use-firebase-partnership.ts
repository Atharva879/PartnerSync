import { useEffect, useMemo, useState } from "react";

import { useFirebaseAuth } from "@/hooks/use-firebase-auth";
import { subscribeToMyPartnerships } from "@/lib/firebase-repository";
import type { FirebasePartnership } from "@/shared/firebase-schema";

/** Provides the signed-in user's current one-to-one collaboration state from Firestore. */
export function useFirebasePartnership() {
  const { user } = useFirebaseAuth();
  const [partnerships, setPartnerships] = useState<FirebasePartnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPartnerships([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    return subscribeToMyPartnerships(
      user.uid,
      (nextPartnerships) => {
        setPartnerships(nextPartnerships);
        setError(null);
        setLoading(false);
      },
      (nextError) => {
        setError(nextError.message || "Unable to load your partner connection.");
        setLoading(false);
      },
    );
  }, [user]);

  return useMemo(() => {
    const activePartnership = partnerships.find((item) => item.status === "active") ?? null;
    const incomingRequest = partnerships.find(
      (item) => item.status === "pending" && item.recipientId === user?.uid,
    ) ?? null;
    const outgoingRequest = partnerships.find(
      (item) => item.status === "pending" && item.requesterId === user?.uid,
    ) ?? null;

    const latestPartnership = activePartnership ?? incomingRequest ?? outgoingRequest ?? partnerships[0] ?? null;

    return { activePartnership, error, incomingRequest, latestPartnership, loading, outgoingRequest };
  }, [error, loading, partnerships, user?.uid]);
}
