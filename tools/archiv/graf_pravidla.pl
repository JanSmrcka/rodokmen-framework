% Pravidla nad grafem rodokmenu. Fakta: python3 tools/graf.py prolog > /tmp/graf.pl
% Použití:  swipl /tmp/graf.pl tools/graf_pravidla.pl
%   ?- sourozenec('josefa-pokorna-1895', X).
%   ?- bratranec(X, Y), osoba(X, JX, _, _).
%   ?- predek(P, 'jan-novak-1890'), osoba(P, J, _, doc).
:- discontiguous kmotr/2, svedek/2, pribuzny/2.
kmotr(_, _) :- fail.
svedek(_, _) :- fail.

otec(O, D)  :- rodic(O, D), osoba(O, _, 'M', _).
matka(M, D) :- rodic(M, D), osoba(M, _, 'F', _).
manzel(A, B) :- manzele(A, B) ; manzele(B, A).
predek(P, D) :- rodic(P, D).
predek(P, D) :- rodic(P, X), predek(X, D).
sourozenec(A, B) :- rodic(R, A), rodic(R, B), A \== B.             % včetně nevlastních (jeden společný rodič)
vlastni_sourozenec(A, B) :- otec(O, A), otec(O, B), matka(M, A), matka(M, B), A \== B.
prarodic(P, D) :- rodic(P, X), rodic(X, D).
stryc_teta(S, D) :- rodic(R, D), sourozenec(S, R).
bratranec(A, B) :- rodic(RA, A), rodic(RB, B), sourozenec(RA, RB).
svagr(A, B) :- manzel(A, X), sourozenec(X, B).
svagr(A, B) :- sourozenec(A, X), manzel(X, B).
% kmotr v rodině: kmotr dítěte je sám příbuzný (sourozenec rodiče apod.)
kmotr_z_rodiny(K, D) :- kmotr(K, D), rodic(R, D), (sourozenec(K, R) ; rodic(K, R)).
