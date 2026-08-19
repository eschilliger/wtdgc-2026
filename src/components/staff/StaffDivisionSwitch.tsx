"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { WtdgcDivision } from "../../domain/wtdgc/competition";
import styles from "./StaffDivisionSwitch.module.css";

type Props = {
  division: WtdgcDivision;
  roundNumber?: number;
};

function rememberDivision(division: WtdgcDivision) {
  document.cookie = `wtdgc_staff_division=${division}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function hrefFor(division: WtdgcDivision, roundNumber?: number) {
  return roundNumber
    ? `/staff/rounds/${division}/${roundNumber}`
    : `/staff?division=${division}`;
}

export function StaffDivisionSwitch({ division, roundNumber }: Props) {
  useEffect(() => {
    rememberDivision(division);
  }, [division]);

  return (
    <nav className={styles.switch} aria-label="Division Staff">
      {(["open", "masters"] as const).map((item) => (
        <Link
          key={item}
          href={hrefFor(item, roundNumber)}
          className={item === division ? styles.active : undefined}
          aria-current={item === division ? "page" : undefined}
          onClick={() => rememberDivision(item)}
        >
          {item === "open" ? "Open" : "Masters"}
        </Link>
      ))}
    </nav>
  );
}
