"""Check baseline.json: every fact is labelled and sourced, derived values recompute,
and register values still match the raw RZReg snapshot. Run: python3 data/check.py"""
import json, pathlib, sys

HERE = pathlib.Path(__file__).parent
data = json.loads((HERE / "baseline.json").read_text())
# the register snapshot is not in the repository (no stated licence); get it with scripts/fetch_sources.py
RAW_FILE = HERE / "rzreg-sites.json"
raw = json.loads(RAW_FILE.read_text()) if RAW_FILE.exists() else None

STATUSES = set(data["meta"]["conventions"]["statuses"])
SOURCES = set(data["sources"])
errors = []

RAW_FIELD = {  # baseline fact -> (register section, field)
    "floorArea": ("general", "surfaceAreaInM2"),
    "itCapacity": ("general", "itNominalConnectedLoadInKw"),
    "totalEnergy": ("energy", "totalConsumptionInKwh"),
    "pue": ("energy", "powerUsageEffectiveness"),
    "renewableShare": ("energy", "renewableEnergyFactor"),
    "coolingEfficiencyRatio": ("energy", "coolingEfficiencyRatio"),
    "wue": ("waterHeat", "waterUsageEffectiveness"),
    "wasteHeatReleased": ("waterHeat", "wasteHeatReleasedInKwh"),
    "wasteHeatReused": ("waterHeat", "wasteHeatReusedInKwh"),
    "wasteHeatTemp": ("waterHeat", "avgWasteHeatTempInCelsius"),
}
REGISTER_NAME = {"vantage-fra21": "FRA21", "tsystems-biere-2": "Biere Cluster 2", "yondr-bischofsheim": "Yondr Germany GmbH"}
raw_by_name = {r["general"]["name"]: r for r in raw or []}


def check_fact(where, f):
    if f.get("status") not in STATUSES:
        errors.append(f"{where}: unknown status {f.get('status')!r}")
    srcs = f.get("source")
    if f.get("status") == "derived":
        if not f.get("formula") or not f.get("inputs"):
            errors.append(f"{where}: derived fact needs formula and inputs")
        return
    for s in (srcs if isinstance(srcs, list) else [srcs]):
        if s not in SOURCES:
            errors.append(f"{where}: unknown source {s!r}")


def close(a, b, rel=0.01):
    return abs(a - b) <= rel * max(abs(a), abs(b), 1e-9)


for sid, site in data["sites"].items():
    facts = site.get("facts", {})
    for k, f in facts.items():
        check_fact(f"{sid}.facts.{k}", f)
    for k, f in site.get("derived", {}).items():
        check_fact(f"{sid}.derived.{k}", f)
    for k in ("opened", "stage"):
        if k in site:
            check_fact(f"{sid}.{k}", site[k])
    if "noiseLimits" in site:
        nl = site["noiseLimits"]
        check_fact(f"{sid}.noiseLimits", nl)
        if "noiseReport" in nl:
            check_fact(f"{sid}.noiseLimits.noiseReport", nl["noiseReport"])
        for kind in ("plantShare", "totalCap"):
            for pt in nl.get(kind, {}).get("points", []):
                if not (0 < pt["night"] <= pt["day"] <= 70):
                    errors.append(f"{sid}.noiseLimits.{kind}: implausible values {pt}")
    for k, f in site.get("planning", {}).items():
        check_fact(f"{sid}.planning.{k}", f)

    # register values must match the raw snapshot
    if sid in REGISTER_NAME and raw is not None:
        r = raw_by_name.get(REGISTER_NAME[sid])
        if not r:
            errors.append(f"{sid}: not found in rzreg-sites.json")
        else:
            for k, f in facts.items():
                if f.get("source") == "rzreg" and k in RAW_FIELD and f["value"] is not None:
                    sec, fld = RAW_FIELD[k]
                    if not close(float(f["value"]), float(r[sec][fld])):
                        errors.append(f"{sid}.{k}: {f['value']} != register {r[sec][fld]}")

    # recompute derived values
    d = site.get("derived", {})
    v = lambda k: (facts.get(k) or d.get(k))["value"]
    expect = {}
    if "itEnergy" in d: expect["itEnergy"] = v("totalEnergy") / v("pue")
    if "avgItLoad" in d: expect["avgItLoad"] = expect["itEnergy"] / 8760 / 1000
    if "avgFacilityLoad" in d: expect["avgFacilityLoad"] = v("totalEnergy") / 8760 / 1000
    if "utilisation" in d: expect["utilisation"] = expect["avgItLoad"] * 1000 / v("itCapacity") * 100
    if "waterPerYear" in d: expect["waterPerYear"] = v("wue") * expect["itEnergy"] / 1000
    if "waterPerDay" in d: expect["waterPerDay"] = expect["waterPerYear"] / 365
    if "householdEquivalent" in d:
        expect["householdEquivalent"] = expect["waterPerDay"] * 1000 / data["references"]["householdWaterPerPerson"]["value"]
    for k, val in expect.items():
        if not close(d[k]["value"], val, rel=0.02):
            errors.append(f"{sid}.derived.{k}: stored {d[k]['value']} vs computed {val:.4g}")

for sid, site in data["sites"].items():
    for k, f in site.get("backup", {}).items():
        check_fact(f"{sid}.backup.{k}", f)
for mode in data["cooling"].values():
    for k, f in mode.items():
        check_fact(f"cooling.{k}", f)
for grp in data["environment"].values():
    for k, f in grp.items():
        check_fact(f"environment.{k}", f)
for k, f in data["seasons"].items():
    check_fact(f"seasons.{k}", f)
for k, f in data["sound"].items():
    check_fact(f"sound.{k}", f)
for k, f in data["uses"].items():
    check_fact(f"uses.{k}", f)
for k, f in data["jobs"].items():
    check_fact(f"jobs.{k}", f)
for c in data["claims"]:
    if c["verdict"] not in data["meta"]["verdicts"]:
        errors.append(f"claim {c['id']}: unknown verdict {c['verdict']}")
    for e in c["evidence"] + ([c["said"]] if "said" in c else []):
        check_fact(f"claim.{c['id']}", e)
co2 = data["environment"]["climate"]
fra21E = data["sites"]["vantage-fra21"]["facts"]["totalEnergy"]["value"]
if not close(co2["co2LocationBased"]["value"], fra21E * co2["gridFactor2025"]["value"] / 1e6):
    errors.append("co2LocationBased does not recompute")
R = data["references"]
if not close(R["phoneCharge"]["value"], R["phoneBattery"]["value"] / R["chargerEfficiency"]["value"]):
    errors.append("references.phoneCharge does not recompute")
for group, items in data["regulation"].items():
    for k, f in items.items():
        check_fact(f"regulation.{group}.{k}", f)
for k, f in data["references"].items():
    check_fact(f"references.{k}", f)

# Biere: the two register clusters should add up to the operator's campus figure
biere = data["sites"]["tsystems-biere-2"]["facts"]["campusItCapacity"]["value"]
clusters = sum(raw_by_name[n]["general"]["itNominalConnectedLoadInKw"] for n in ("Biere Cluster 1", "Biere Cluster 2")) if raw else biere
if clusters != biere:
    errors.append(f"Biere clusters sum {clusters} kW != operator campus {biere} kW")
for s in data["scenarios"]["cooling"]:
    for k in ("wue", "pue"):
        if k in s:
            check_fact(f"scenario.{s['id']}.{k}", s[k])
    if "status" in s:
        check_fact(f"scenario.{s['id']}", s)

# second site: The Dalles
td = json.loads((HERE / "thedalles.json").read_text())
TS = set(td["sources"])
for k, f in td["facts"].items():
    if f.get("status") not in STATUSES: errors.append(f"thedalles.{k}: unknown status")
    for sname in ([f["source"]] if isinstance(f.get("source"), str) else f.get("source", [])):
        if sname not in TS: errors.append(f"thedalles.{k}: unknown source {sname}")
tf = td["facts"]
if not close(tf["waterConsumptionM3"]["value"], tf["waterConsumption"]["value"] * 1e6 * 3.78541 / 1000): errors.append("thedalles water m3 does not recompute")
if not close(tf["waterPerDayM3"]["value"], tf["waterConsumptionM3"]["value"] / 365): errors.append("thedalles water per day does not recompute")
# third site: the fictional ideal datacenter
idl = json.loads((HERE / "ideal.json").read_text())
IS = set(idl["sources"])
TIERS = {"proven", "promised", "research", "choice", "calculated"}
for k, f in idl["facts"].items():
    if f.get("status") not in STATUSES: errors.append(f"ideal.{k}: unknown status")
    if f.get("tier") not in TIERS: errors.append(f"ideal.{k}: unknown tier")
    if f.get("status") not in ("derived", "chosen") and not f.get("source"): errors.append(f"ideal.{k}: no source")
    if f.get("status") == "derived" and not f.get("formula"): errors.append(f"ideal.{k}: derived without formula")
    for sname in ([f["source"]] if isinstance(f.get("source"), str) else f.get("source", [])):
        if sname not in IS: errors.append(f"ideal.{k}: unknown source {sname}")
I = {k: f["value"] for k, f in idl["facts"].items()}
for k, want in {
    "facilityPower": I["itCapacity"] * I["pue"],
    "energyYear": I["itCapacity"] * I["pue"] * 8.76,
    "overheadYear": I["itCapacity"] * (I["pue"] - 1) * 8.76,
    "waterProvenM3": I["itCapacity"] * 8.76 * 1e6 * I["wueProven"] / 1000,
    "waterProvenDay": I["itCapacity"] * 8.76 * 1e6 * I["wueProven"] / 1000 / 365,
    "heatYear": I["itCapacity"] * 8.76,
    "heatTimesLulea": I["itCapacity"] * 8.76 / I["luleaHeat"],
    "erfMax": I["luleaHeat"] / (I["itCapacity"] * I["pue"] * 8.76) * 100,
    "co2Year": I["itCapacity"] * I["pue"] * 8.76 * I["gridCO2"],
    "batteryScaled": I["itCapacity"] * I["pue"] * 80 / 60,
}.items():
    if abs(I[k] - want) > max(0.6, abs(want) * 0.01): errors.append(f"ideal.{k} = {I[k]} does not recompute ({want:.1f})")
if I["itCapacity"] <= I["largestRunning"]: errors.append("ideal campus is not bigger than the largest running one")
if errors:
    print("\n".join(errors)); sys.exit(1)
if raw is None: print("note: register snapshot missing, so register values were not compared (run python3 scripts/fetch_sources.py)")
print(f"OK: {len(data['sites'])} sites, {len(SOURCES)} sources, all facts labelled, derived values and register values check out.")
