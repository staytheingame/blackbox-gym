"use client";

import { useActionState } from "react";
import { REQUIREMENT_KINDS, REQUIREMENT_KIND_LABEL } from "@/domain/rank/progress";
import { techniques } from "@/data/techniques";
import {
  addRequirementAction,
  createRankAction,
  type RankActionState,
} from "./actions";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initial: RankActionState = {};

function Feedback({ state }: { state: RankActionState }) {
  if (state.error) {
    return <p className="text-sm text-red-300">{state.error}</p>;
  }
  if (state.success) {
    return <p className="text-sm text-brand-yellow">{state.success}</p>;
  }
  return null;
}

export function CreateRankForm() {
  const [state, formAction, pending] = useActionState(createRankAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rank-name" className={labelClass}>
            Kuşak adı
          </label>
          <input
            id="rank-name"
            name="name"
            required
            maxLength={40}
            placeholder="Sarı Kuşak"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="rank-color" className={labelClass}>
            Renk
          </label>
          <input
            id="rank-color"
            name="color"
            type="color"
            defaultValue="#facc15"
            className={`${inputClass} h-10 p-1`}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rank-sessions" className={labelClass}>
            En az ders
          </label>
          <input
            id="rank-sessions"
            name="minSessions"
            type="number"
            min={0}
            max={500}
            defaultValue={16}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="rank-weeks" className={labelClass}>
            En az hafta
          </label>
          <input
            id="rank-weeks"
            name="minWeeks"
            type="number"
            min={0}
            max={200}
            defaultValue={8}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="rank-summary" className={labelClass}>
          Açıklama
        </label>
        <input
          id="rank-summary"
          name="summary"
          maxLength={200}
          placeholder="Temel duruş, jab-cross ve savunma refleksi"
          className={inputClass}
        />
      </div>

      <Feedback state={state} />

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Ekleniyor…" : "Kuşağı Ekle"}
      </button>
    </form>
  );
}

export function AddRequirementForm({
  ranks,
}: {
  ranks: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    addRequirementAction,
    initial,
  );

  if (ranks.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Önce en az bir kuşak ekle — müfredat maddeleri kuşağa bağlanır.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="req-rank" className={labelClass}>
            Kuşak
          </label>
          <select
            id="req-rank"
            name="rankId"
            required
            defaultValue={ranks[0].id}
            className={inputClass}
          >
            {ranks.map((rank) => (
              <option key={rank.id} value={rank.id}>
                {rank.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="req-kind" className={labelClass}>
            Tür
          </label>
          <select
            id="req-kind"
            name="kind"
            defaultValue="teknik"
            className={inputClass}
          >
            {REQUIREMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {REQUIREMENT_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="req-label" className={labelClass}>
          Madde
        </label>
        <input
          id="req-label"
          name="label"
          required
          maxLength={120}
          placeholder="Jab-cross kombinasyonunu ped üzerinde 3 round"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="req-technique" className={labelClass}>
          Teknik bağlantısı (opsiyonel)
        </label>
        <select
          id="req-technique"
          name="techniqueSlug"
          defaultValue=""
          className={inputClass}
        >
          <option value="">Yok</option>
          {techniques.map((technique) => (
            <option key={technique.slug} value={technique.slug}>
              {technique.name}
            </option>
          ))}
        </select>
      </div>

      <Feedback state={state} />

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Ekleniyor…" : "Maddeyi Ekle"}
      </button>
    </form>
  );
}
