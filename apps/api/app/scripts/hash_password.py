from getpass import getpass

from argon2 import PasswordHasher


def main() -> None:
    password = getpass("Password: ")
    confirmation = getpass("Confirm password: ")
    if not password or password != confirmation:
        raise SystemExit("Passwords did not match.")
    print(PasswordHasher().hash(password))


if __name__ == "__main__":
    main()
