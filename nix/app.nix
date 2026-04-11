# SetFuel Nix outputs for one platform (imported from flake.nix per system).
{ pkgs, flake-utils }:

let
  setfuel = pkgs.writeShellApplication {
    name = "setfuel";
    bashOptions = [
      "errexit"
      "nounset"
      "pipefail"
    ];
    runtimeInputs = [
      pkgs.postgresql_16
      pkgs.nodejs_22
      pkgs.git
    ];
    text = builtins.readFile ./setfuel.bash;
  };

  # Thin wrapper so `nix run .#postgres-up` still works without extra `--`.
  appFor =
    sub:
    flake-utils.lib.mkApp {
      drv = pkgs.writeShellApplication {
        name = "setfuel-${sub}";
        bashOptions = [
          "errexit"
          "nounset"
          "pipefail"
        ];
        text = ''
          exec ${setfuel}/bin/setfuel ${sub} "$@"
        '';
      };
    };
in
{
  devShells.default = pkgs.mkShell {
    name = "setfuel-dev";
    packages = with pkgs; [
      nodejs_22
      postgresql_16
      openssl
      git
    ];
    shellHook = ''
      echo "SetFuel dev shell — Node $(node --version)"
      echo "Shortcuts: nix run .#postgres-up | .#mobile-start | .#backend-build | .#mobile-build | …"
      echo "Run: nix run .#setfuel -- help"
    '';
  };

  apps = {
    setfuel = flake-utils.lib.mkApp { drv = setfuel; };

    postgres-up = appFor "postgres-up";
    postgres-down = appFor "postgres-down";
    postgres-status = appFor "postgres-status";
    db-create = appFor "db-create";
    backend-migrate = appFor "backend-migrate";
    backend-install = appFor "backend-install";
    backend-build = appFor "backend-build";
    mobile-install = appFor "mobile-install";
    mobile-start = appFor "mobile-start";
    mobile-build = appFor "mobile-build";
  };
}
