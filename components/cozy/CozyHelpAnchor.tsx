"use client";
import {createContext} from 'react';
// Sheet information buttons sit beside the title; full screens place their own.
export const CozyHelpAnchor=createContext<HTMLElement|null>(null);
